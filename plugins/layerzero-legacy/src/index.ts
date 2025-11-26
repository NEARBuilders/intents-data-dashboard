import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";

/**
 * LayerZero (Stargate) Bridge Data Provider Plugin
 *
 * Collects market data from LayerZero's Stargate protocol:
 * - Volume metrics (24h, 7d, 30d)
 * - Rate quotes and fees
 * - Liquidity depth analysis
 * - Supported assets across chains
 *
 * Uses Stargate Finance REST API (https://stargate.finance/api/v1)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://stargate.finance/api/v1"),
    defillamaBaseUrl: z.string().url().default("https://api.llama.fi"),
    timeout: z.number().min(1000).max(60000).default(15000),
    maxRequestsPerSecond: z.number().min(1).max(100).default(10),
  }),

  secrets: z.object({
    // Stargate API doesn't require an API key, but we keep this for consistency
    // and potential future use with premium endpoints
    apiKey: z.string().default("not-required"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      console.log("[LayerZero Plugin] Initializing...");

      // Create service instance with config
      const service = new DataProviderService(
        config.variables.baseUrl,
        config.variables.defillamaBaseUrl,
        config.secrets.apiKey,
        config.variables.timeout,
        config.variables.maxRequestsPerSecond
      );

      // Test the connection during initialization
      console.log("[LayerZero Plugin] Testing connectivity...");
      yield* service.ping();
      console.log("[LayerZero Plugin] Successfully connected to Stargate API");

      return { service };
    }),

  shutdown: () => {
    console.log("[LayerZero Plugin] Shutting down...");
    return Effect.void;
  },

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input }) => {
        console.log(`[LayerZero Plugin] getSnapshot called with ${input.routes.length} routes`);
        const snapshot = await Effect.runPromise(
          service.getSnapshot(input)
        );
        console.log(`[LayerZero Plugin] Snapshot fetched successfully`);
        return snapshot;
      }),

      ping: builder.ping.handler(async () => {
        return await Effect.runPromise(service.ping());
      }),
    };
  }
});
