import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";

/**
 * Wormhole Data Provider Plugin - Collects bridge metrics from Wormhole
 *
 * Wormhole is a message passing protocol enabling cross-chain token transfers.
 * This plugin integrates with Wormholescan API to collect volume, rates, and liquidity data.
 *
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://api.wormholescan.io/api/v1"),
    timeout: z.number().min(1000).max(60000).default(15000),
  }),

  secrets: z.object({
    apiKey: z.string().default("not-required"), // Wormholescan is a public API
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create service instance with config
      const service = new DataProviderService(
        config.variables.baseUrl,
        config.secrets.apiKey,
        config.variables.timeout
      );

      // Test the connection during initialization (non-blocking for tests)
      yield* service.ping().pipe(
        Effect.catchAll((error) => {
          console.warn('[Wormhole] Initial health check failed (non-blocking):', error.message);
          return Effect.succeed({ status: "degraded" as const, timestamp: new Date().toISOString() });
        })
      );

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input }) => {
        const snapshot = await Effect.runPromise(
          service.getSnapshot(input)
        );
        return snapshot;
      }),

      ping: builder.ping.handler(async () => {
        return await Effect.runPromise(service.ping());
      }),
    };
  }
});
