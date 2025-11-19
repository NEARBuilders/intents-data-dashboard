import { DuneClient } from "@duneanalytics/client-sdk";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { DataAggregatorService } from "./service";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    DUNE_API_KEY: z.string()
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      if (!config.secrets.DUNE_API_KEY) console.error("Dune API key not provided.");

      const dune = new DuneClient(config.secrets.DUNE_API_KEY);
      const service = new DataAggregatorService(dune);

      console.log("Aggregator plugin initialized");

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      getProviders: builder.getProviders.handler(async () => {
        const providers = service.getProviders();
        return { providers };
      }),

      sync: builder.sync.handler(async ({ input }) => {
        await service.startSync(input.datasets);
        return {
          status: "sync_initiated" as const,
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
