import { DuneClient } from "@duneanalytics/client-sdk";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { getPluginRuntime } from "./plugins";
import { DataAggregatorService } from "./service";
import { RedisService } from "./services/redis";

export default createPlugin({
  variables: z.object({
    isDevelopment: z.boolean().optional().default(false),
  }),

  secrets: z.object({
    DUNE_API_KEY: z.string(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    NEAR_INTENTS_API_KEY: z.string(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      if (!config.secrets.DUNE_API_KEY) console.error("Dune API key not provided.");

      const dune = new DuneClient(config.secrets.DUNE_API_KEY);

      const redis = new RedisService(config.secrets.REDIS_URL);
      yield* redis.healthCheck();

      const { providers } = yield* getPluginRuntime({
        isDevelopment: config.variables.isDevelopment,
        secrets: config.secrets,
      });

      const service = new DataAggregatorService(dune, providers, redis);

      return { service, providers, redis };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service, redis } = context;

    return {
      getProviders: builder.getProviders.handler(async () => {
        const providers = service.getProviders();
        return { providers };
      }),

      sync: builder.sync.handler(async ({ input }) => {
        await service.startSync(input.datasets);

        const cleared: string[] = [];

        if (!input.datasets || input.datasets.includes('volumes')) {
          const count = await Effect.runPromise(redis.clear('volumes:*'));
          cleared.push(`volumes (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('rates')) {
          const count = await Effect.runPromise(redis.clear('rates:*'));
          cleared.push(`rates (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('liquidity')) {
          const count = await Effect.runPromise(redis.clear('liquidity:*'));
          cleared.push(`liquidity (${count} keys)`);
        }

        if (!input.datasets || input.datasets.includes('assets')) {
          const count = await Effect.runPromise(redis.clear('assets:*'));
          cleared.push(`assets (${count} keys)`);
        }

        console.log('Cache cleared:', cleared.join(', '));

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
