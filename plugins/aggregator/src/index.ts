import { DuneClient } from "@duneanalytics/client-sdk";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createAssetEnrichmentClient } from "./clients/asset-enrichment-client";
import { contract } from "./contract";
import { getPluginRuntime } from "./plugins";
import { DataAggregatorService } from "./service";
import type { CacheService } from "./services/cache";
import { MemoryCache } from "./services/cache";
import { RedisService } from "./services/redis";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    DUNE_API_KEY: z.string(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    NEAR_INTENTS_API_KEY: z.string(),
    ASSET_ENRICHMENT_URL: z.string().default("http://localhost:6767/api/rpc"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      if (!config.secrets.DUNE_API_KEY) console.error("Dune API key not provided.");

      const dune = new DuneClient(config.secrets.DUNE_API_KEY);

      let cache: CacheService = new RedisService(config.secrets.REDIS_URL);
      const healthCheckResult = yield* cache.healthCheck().pipe(
        Effect.catchAll(() => {
          console.warn('\n⚠️  Redis not available - using in-memory cache (data won\'t persist)');
          console.warn('   For persistent cache, run: docker compose up -d\n');
          cache = new MemoryCache();
          return cache.healthCheck();
        })
      );

      console.log(`[Cache] Using ${cache instanceof RedisService ? 'Redis' : 'in-memory'} cache - ${healthCheckResult}`);

      const { providers } = yield* getPluginRuntime({
        secrets: config.secrets,
      });

      const enrichAssetClient = createAssetEnrichmentClient(config.secrets.ASSET_ENRICHMENT_URL);

      const service = new DataAggregatorService(dune, providers, enrichAssetClient, cache);

      return { service, providers, cache };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service, cache } = context;

    return {
      getProviders: builder.getProviders.handler(async () => {
        const providers = service.getProviders();
        return { providers };
      }),

      sync: builder.sync.handler(async ({ input }) => {
        const cleared: string[] = [];

        if (!input.datasets || input.datasets.includes('volumes')) {
          const count = await Effect.runPromise(cache.clear('volumes:*'));
          cleared.push(`volumes (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('rates')) {
          const count = await Effect.runPromise(cache.clear('rates:*'));
          cleared.push(`rates (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('liquidity')) {
          const count = await Effect.runPromise(cache.clear('liquidity:*'));
          cleared.push(`liquidity (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('assets')) {
          const count = await Effect.runPromise(cache.clear('enriched-assets:*'));
          cleared.push(`enriched-assets (${count} keys)`);
        }

        console.log('Cache cleared:', cleared.join(', '));

        if (!input.datasets || input.datasets.includes('assets')) {
          service.rebuildAssetsCache().catch((error) => {
            console.error('[Aggregator] Failed to rebuild assets cache:', error);
          });
        }

        return {
          status: "started" as const,
          timestamp: new Date().toISOString(),
        };
      }),

      getVolumes: builder.getVolumes.handler(async ({ input }) => {
        const result = await service.getVolumes(input);
        return {
          ...result,
          measuredAt: new Date().toISOString(),
        };
      }),

      getVolumesAggregated: builder.getVolumesAggregated.handler(async ({ input }) => {
        const result = await service.getVolumesAggregated(input);
        return {
          ...result,
          measuredAt: new Date().toISOString(),
        };
      }),

      getListedAssets: builder.getListedAssets.handler(async ({ input }) => {
        const result = await service.getListedAssets(input);
        return {
          ...result,
          measuredAt: new Date().toISOString(),
        };
      }),

      getRates: builder.getRates.handler(async ({ input }) => {
        const result = await service.getRates(input);
        return {
          ...result,
          measuredAt: new Date().toISOString(),
        };
      }),

      getLiquidity: builder.getLiquidity.handler(async ({ input }) => {
        const result = await service.getLiquidity(input);
        return {
          ...result,
          measuredAt: new Date().toISOString(),
        };
      }),
    };
  },
});
