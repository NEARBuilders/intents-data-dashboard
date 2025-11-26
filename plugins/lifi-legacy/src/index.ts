import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";
import { HttpUtils } from "./utils/http";

/**
 * Data Provider Plugin Template - Template for building single-provider bridge data adapters.
 *
 * This template demonstrates how to implement the data provider contract for one provider.
 * Choose ONE provider (LayerZero, Wormhole, CCTP, Across, deBridge, Axelar, Li.Fi) and
 * replace the mock implementation with actual API calls.
 * 
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://li.quest/v1"),
    // Rate limiter settings (make per-provider limits configurable via ENV)
    rateLimitConcurrency: z.number().int().min(1).default(5),
    rateLimitMinTimeMs: z.number().int().min(0).default(200),
  }),

  // Li.Fi public endpoints do not require authentication
  secrets: z.object({}).optional(),

  contract,

  initialize: (config: any) =>
    Effect.gen(function* () {
      // Configure HTTP rate limiter from variables before creating the service
      HttpUtils.configure({
        maxConcurrent: config.variables.rateLimitConcurrency,
        minTime: config.variables.rateLimitMinTimeMs,
      });

      // Create service instance with config
      const service = new DataProviderService(
        config.variables.baseUrl
      );

      // Test the connection during initialization
      yield* service.ping();

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context: any, builder: any) => {
    const { service } = context as { service: any };

    return {
      getSnapshot: builder.getSnapshot.handler(async ({ input }: any) => {
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
