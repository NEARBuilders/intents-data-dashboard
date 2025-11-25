import type AcrossPlugin from "@data-provider/across";
import type NearIntentsPlugin from "@data-provider/near-intents";
import type { PluginClient } from "@data-provider/shared-contract";
import { createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";

type AggregatorRegistry = {
  "@data-provider/near-intents": typeof NearIntentsPlugin;
  "@data-provider/across": typeof AcrossPlugin;
};

const PLUGIN_URLS = {
  production: {
    "@data-provider/near-intents": "https://elliot-braem-862-data-provider-near-intents-data--2a21768a2-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/across": "https://elliot-braem-861-data-provider-across-data-provid-8e6d9e9d5-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/near-intents": "http://localhost:3015/remoteEntry.js",
    "@data-provider/across": "http://localhost:3016/remoteEntry.js",
  }
} as const;

export interface PluginRuntimeConfig {
  isDevelopment: boolean;
  secrets: {
    NEAR_INTENTS_API_KEY: string;
    DUNE_API_KEY: string;
    REDIS_URL: string;
  };
}

export function getPluginRuntime(config: PluginRuntimeConfig) {
  return Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const urls = PLUGIN_URLS[config.isDevelopment ? 'development' : 'production'];

        const runtime = createPluginRuntime<AggregatorRegistry>({
          registry: {
            "@data-provider/near-intents": { remoteUrl: urls["@data-provider/near-intents"] },
            "@data-provider/across": { remoteUrl: urls["@data-provider/across"] },
          },
          secrets: config.secrets,
        });

        const nearIntents = await runtime.usePlugin("@data-provider/near-intents", {
          variables: {},
          secrets: {
            apiKey: config.secrets.NEAR_INTENTS_API_KEY
          }
        });

        const across = await runtime.usePlugin("@data-provider/across", {
          variables: {
            timeout: 30000
          },
          secrets: {}
        });

        const providers: Record<string, PluginClient> = {
          "near_intents": nearIntents.client,
          "across": across.client,
        };

        return { runtime, providers };
      },
      catch: (error) => new Error(`Failed to initialize plugin runtime: ${error}`)
    }),
    ({ runtime }) => Effect.sync(() => {
      if (runtime && typeof runtime.shutdown === 'function') {
        runtime.shutdown();
      }
    })
  );
}
