import { DuneClient } from "@duneanalytics/client-sdk";
import { createPlugin, createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import type DataProviderPlugin from "@data-provider/template";

import { contract } from "./contract";
import { DataAggregatorService } from "./service";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/across": typeof DataProviderPlugin;
    "@data-provider/near-intents": typeof DataProviderPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/across": "https://elliot-braem-609-data-provider-across-data-provid-001053a52-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/near-intents": "https://elliot-braem-610-data-provider-near-intents-data--5920f7dfd-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/across": "http://localhost:3016/remoteEntry.js",
    "@data-provider/near-intents": "http://localhost:3015/remoteEntry.js",
  }
} as const;

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    DUNE_API_KEY: z.string(),
    NEAR_INTENTS_API_KEY: z.string()
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      if (!config.secrets.DUNE_API_KEY) console.error("Dune API key not provided.");

      const dune = new DuneClient(config.secrets.DUNE_API_KEY);
      
      const isDevelopment = false;
      // const isDevelopment = process.env.NODE_ENV !== 'production';
      const urls = PLUGIN_URLS[isDevelopment ? 'development' : 'production'];
      
      const runtime = yield* Effect.acquireRelease(
        Effect.succeed(
          createPluginRuntime({
            registry: {
              "@data-provider/near-intents": { remoteUrl: urls["@data-provider/near-intents"] },
              "@data-provider/across": { remoteUrl: urls["@data-provider/across"] },
            },
            secrets: {
              NEAR_INTENTS_API_KEY: config.secrets.NEAR_INTENTS_API_KEY
            },
          })
        ),
        (runtime) => Effect.sync(() => {
          console.log("Shutting down provider plugins");
        })
      );
      
      const nearIntents = yield* Effect.tryPromise({
        try: () => runtime.usePlugin("@data-provider/near-intents", {
          variables: { 
          },
          secrets: {
            apiKey: "{{NEAR_INTENTS_API_KEY}}"
          }
        }),
        catch: (error) => new Error(`Failed to load NEAR Intents plugin: ${error}`)
      });
      
      const across = yield* Effect.tryPromise({
        try: () => runtime.usePlugin("@data-provider/across", {
          variables: { 
            timeout: 30000
          },
          secrets: {
            apiKey: "not-required"
          }
        }),
        catch: (error) => new Error(`Failed to load Across plugin: ${error}`)
      });
      
      const providers = {
        "near_intents": nearIntents.client,
        "across": across.client,
      };

      const service = new DataAggregatorService(dune, providers);

      console.log("Aggregator plugin initialized with provider plugins");

      return { service, runtime, providers };
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
