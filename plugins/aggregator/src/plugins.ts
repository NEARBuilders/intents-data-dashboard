import { createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";
import type NearIntentsPlugin from "@data-provider/near-intents";
import type AcrossPlugin from "@data-provider/across";
import type CanonicalAssetConversionPlugin from "@data-provider/canonical-asset-conversion";
import type { PluginClient } from "@data-provider/shared-contract";

type AggregatorRegistry = {
  "@data-provider/near-intents": typeof NearIntentsPlugin;
  "@data-provider/across": typeof AcrossPlugin;
  "@data-provider/canonical-asset-conversion": typeof CanonicalAssetConversionPlugin;
};

const PLUGIN_URLS = {
  production: {
    "@data-provider/near-intents": "https://elliot-braem-703-data-provider-near-intents-data--383cccfa0-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/across": "https://elliot-braem-686-data-provider-across-data-provid-39c5d431c-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/canonical-asset-conversion": "https://elliot-braem-706-data-provider-canonical-asset-co-573bd0884-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/near-intents": "http://localhost:3015/remoteEntry.js",
    "@data-provider/across": "http://localhost:3016/remoteEntry.js",
    "@data-provider/canonical-asset-conversion": "http://localhost:3017/remoteEntry.js",
  }
} as const;

export interface PluginRuntimeConfig {
  isDevelopment: boolean;
  secrets: {
    NEAR_INTENTS_API_KEY: string;
    DUNE_API_KEY: string;
    REDIS_URL: string;
    COINMARKETCAP_API_KEY?: string;
    COINGECKO_PRO_API_KEY?: string;
    COINGECKO_DEMO_API_KEY?: string;
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
            "@data-provider/canonical-asset-conversion": { remoteUrl: urls["@data-provider/canonical-asset-conversion"] },
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

        const canonicalAsset = await runtime.usePlugin("@data-provider/canonical-asset-conversion", {
          variables: {},
          secrets: {
            COINGECKO_PRO_API_KEY: config.secrets.COINGECKO_PRO_API_KEY,
            COINGECKO_DEMO_API_KEY: config.secrets.COINGECKO_DEMO_API_KEY,
          }
        });

        const providers: Record<string, PluginClient> = {
          "near_intents": nearIntents.client,
          "across": across.client,
        };

        return { runtime, providers, canonicalAssetClient: canonicalAsset.client };
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
