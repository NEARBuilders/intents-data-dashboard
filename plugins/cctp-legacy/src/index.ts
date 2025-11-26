import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";

/**
 * CCTP (Circle Cross-Chain Transfer Protocol) Data Provider Plugin
 *
 * Circle's native burn-and-mint protocol for USDC cross-chain transfers.
 * Provides volume, rate, liquidity, and asset data for NEAR Intents dashboard.
 *
 * Provider: Circle CCTP
 * Documentation: https://developers.circle.com/stablecoins/docs/cctp-getting-started
 * API: Public (no authentication required)
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://iris-api.circle.com"),
    timeout: z.number().min(1000).max(60000).default(15000),
  }),

  secrets: z.object({
    apiKey: z.string().min(1, "API key is required").default("not-required"),
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

      // Test the connection during initialization
      yield* service.ping();

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input }) => {
        try {
          console.log("=== GETSNAPSHOT CALLED ===");
          console.log("Input:", JSON.stringify(input, null, 2));

          const snapshot = await service.getSnapshot(input);

          console.log("=== GETSNAPSHOT SUCCESS ===");
          return snapshot;
        } catch (error: unknown) {
          // Log error details without triggering Next.js source map bug
          const errorInfo = {
            type: typeof error,
            constructor: (error as any)?.constructor?.name,
            message: (error as any)?.message,
            stack: (error as any)?.stack,
            stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          };
          console.log("=== RAW ERROR IN GETSNAPSHOT ===", JSON.stringify(errorInfo, null, 2));
          throw error;
        }
      }),

      ping: builder.ping.handler(async () => {
        return await Effect.runPromise(service.ping());
      }),
    };
  }
});
