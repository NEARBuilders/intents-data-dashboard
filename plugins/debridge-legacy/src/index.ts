import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";

/**
 * deBridge DLN Data Provider Plugin
 *
 * Collects cross-chain bridge metrics from deBridge Liquidity Network.
 * deBridge enables fast, single-transaction cross-chain swaps without locking assets.
 * 
 * Features:
 * - Production-grade rate limiting (Bottleneck)
 * - Precise decimal arithmetic (decimal.js)
 * - Exponential backoff with jitter
 * - Comprehensive error handling
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://dln.debridge.finance/v1.0"),
    defillamaBaseUrl: z.string().url().default("https://bridges.llama.fi"),
    timeout: z.number().min(1000).max(60000).default(30000),
    maxRequestsPerSecond: z.number().min(1).max(100).default(10),
  }),

  secrets: z.object({
    apiKey: z.string().default("not-required"),
  }),

  contract,

  initialize: (config: any) =>
    Effect.gen(function* () {
      // Create service instance with config
      const service = new DataProviderService(
        config.variables.baseUrl,
        config.variables.defillamaBaseUrl,
        config.secrets?.apiKey ?? "not-required",
        config.variables.timeout,
        config.variables.maxRequestsPerSecond
      );

      // Test the connection during initialization, but don't fail hard in dev environments.
      yield* Effect.catchAll(
        service.ping(),
        (error) =>
          Effect.sync(() => {
            console.warn(
              "[deBridge] Ping failed during initialization:",
              error instanceof Error ? error.message : String(error),
            );
          }),
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
