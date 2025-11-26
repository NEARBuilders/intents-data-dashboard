import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataProviderService } from "./service";

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
    baseUrl: z.string().url().default("https://api.axelarscan.io/api"),
    timeout: z.number().min(1000).max(60000).default(10000),
  }),

  secrets: z.object({
    apiKey: z.string().default(""), // Axelar API is public, no key required
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
