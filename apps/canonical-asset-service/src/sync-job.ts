import { Effect } from 'every-plugin/effect';
import type { Plugins } from './plugins';

export interface SyncJobConfig {
  aggregatorUrl: string;
  maxSyncWaitAttempts?: number;
  syncCheckIntervalMs?: number;
}

export const runOrchestratedSync = (
  plugins: Plugins,
  config: SyncJobConfig
) => Effect.gen(function* () {
  const { canonical } = plugins;
  const maxAttempts = config.maxSyncWaitAttempts ?? 60;
  const checkInterval = config.syncCheckIntervalMs ?? 5000;

  console.log('[Sync Job] Starting orchestrated sync...');

  console.log('[Sync Job] Step 1: Triggering asset-enrichment sync...');
  yield* Effect.tryPromise({
    try: () => canonical.client.sync(),
    catch: (error) => new Error(`Failed to initiate asset-enrichment sync: ${error}`),
  });
  console.log('[Sync Job] Asset-enrichment sync initiated');

  console.log('[Sync Job] Step 2: Waiting for asset-enrichment sync to complete...');
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = yield* Effect.tryPromise({
      try: () => canonical.client.getSyncStatus(),
      catch: (error) => new Error(`Failed to get sync status: ${error}`),
    });

    if (status.status === 'idle') {
      console.log('[Sync Job] Asset-enrichment sync completed successfully');
      break;
    }

    if (status.status === 'error') {
      const errorMsg = status.errorMessage || 'Unknown error';
      console.error('[Sync Job] Asset-enrichment sync failed:', errorMsg);
      return yield* Effect.fail(new Error(`Asset-enrichment sync failed: ${errorMsg}`));
    }

    console.log(`[Sync Job] Asset-enrichment sync in progress... (${attempt + 1}/${maxAttempts})`);

    if (attempt === maxAttempts - 1) {
      return yield* Effect.fail(new Error('Asset-enrichment sync timed out'));
    }

    yield* Effect.sleep(`${checkInterval} millis`);
  }

  console.log('[Sync Job] Step 3: Triggering aggregator cache rebuild...');
  const aggregatorSyncUrl = `${config.aggregatorUrl}/sync`;
  
  const result = yield* Effect.tryPromise({
    try: async () => {
      const response = await fetch(aggregatorSyncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          datasets: ['assets'],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Aggregator sync failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    },
    catch: (error) => new Error(`Failed to trigger aggregator sync: ${error}`),
  });

  console.log('[Sync Job] Aggregator cache rebuild initiated:', result);
  console.log('[Sync Job] Orchestrated sync complete');
});
