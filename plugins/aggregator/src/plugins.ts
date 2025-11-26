import type AcrossPlugin from "@data-provider/across";
import type CBridgePlugin from "@data-provider/cbridge";
import type CCTPPlugin from "@data-provider/cctp";
import type DeBridgePlugin from "@data-provider/debridge";
import type LayerZeroPlugin from "@data-provider/layerzero";
import type LiFiPlugin from "@data-provider/lifi";
import type NearIntentsPlugin from "@data-provider/near-intents";
import type { PluginClient } from "@data-provider/shared-contract";
import type WormholePlugin from "@data-provider/wormhole";
import { createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";

type AggregatorRegistry = {
  "@data-provider/near-intents": typeof NearIntentsPlugin;
  "@data-provider/across": typeof AcrossPlugin;
  "@data-provider/layerzero": typeof LayerZeroPlugin;
  // "@data-provider/lifi": typeof LiFiPlugin;
  // "@data-provider/axelar": typeof AxelarPlugin;
  "@data-provider/cctp": typeof CCTPPlugin;
  // "@data-provider/cbridge": typeof CBridgePlugin;
  // "@data-provider/debridge": typeof DeBridgePlugin;
  // "@data-provider/wormhole": typeof WormholePlugin;
};

const PLUGIN_URLS = {
  "@data-provider/near-intents": "https://elliot-braem-905-data-provider-near-intents-data--c85c7d660-ze.zephyrcloud.app/remoteEntry.js",
  "@data-provider/across": "https://elliot-braem-904-data-provider-across-data-provid-c64a881f2-ze.zephyrcloud.app/remoteEntry.js",
  "@data-provider/layerzero": "https://elliot-braem-924-data-provider-layerzero-data-pro-4d1997886-ze.zephyrcloud.app/remoteEntry.js",
  // "@data-provider/lifi": "https://elliot-braem-925-data-provider-lifi-data-provider-8895419ba-ze.zephyrcloud.app/remoteEntry.js",
  // "@data-provider/axelar": "https://elliot-braem-926-data-provider-axelar-data-provid-1c63bd4be-ze.zephyrcloud.app/remoteEntry.js",
  "@data-provider/cctp": "https://elliot-braem-927-data-provider-cctp-data-provider-9824940e6-ze.zephyrcloud.app/remoteEntry.js",
  // "@data-provider/cbridge": "https://elliot-braem-928-data-provider-cbridge-data-provi-d63247679-ze.zephyrcloud.app/remoteEntry.js",
  // "@data-provider/debridge": "https://elliot-braem-929-data-provider-debridge-data-prov-bfcbb4ca7-ze.zephyrcloud.app/remoteEntry.js",
  // "@data-provider/wormhole": "https://elliot-braem-930-data-provider-wormhole-data-prov-f8045985e-ze.zephyrcloud.app/remoteEntry.js",
} as const;

export interface PluginRuntimeConfig {
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
        const runtime = createPluginRuntime<AggregatorRegistry>({
          registry: {
            "@data-provider/near-intents": { remoteUrl: PLUGIN_URLS["@data-provider/near-intents"] },
            "@data-provider/across": { remoteUrl: PLUGIN_URLS["@data-provider/across"] },
            "@data-provider/layerzero": { remoteUrl: PLUGIN_URLS["@data-provider/layerzero"] },
            // "@data-provider/lifi": { remoteUrl: PLUGIN_URLS["@data-provider/lifi"] },
            // "@data-provider/axelar": { remoteUrl: PLUGIN_URLS["@data-provider/axelar"] },
            "@data-provider/cctp": { remoteUrl: PLUGIN_URLS["@data-provider/cctp"] },
            // "@data-provider/cbridge": { remoteUrl: PLUGIN_URLS["@data-provider/cbridge"] },
            // "@data-provider/debridge": { remoteUrl: PLUGIN_URLS["@data-provider/debridge"] },
            // "@data-provider/wormhole": { remoteUrl: PLUGIN_URLS["@data-provider/wormhole"] },
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

        const layerzero = await runtime.usePlugin("@data-provider/layerzero", {
          variables: {},
          secrets: {}
        });

        // const lifi = await runtime.usePlugin("@data-provider/lifi", {
        //   variables: {},
        //   secrets: {}
        // });

        // const axelar = await runtime.usePlugin("@data-provider/axelar", {
        //   variables: {},
        //   secrets: {}
        // });

        const circle_cctp = await runtime.usePlugin("@data-provider/cctp", {
          variables: {},
          secrets: {}
        });

        // const cbridge = await runtime.usePlugin("@data-provider/cbridge", {
        //   variables: {},
        //   secrets: {}
        // });

        // const debridge = await runtime.usePlugin("@data-provider/debridge", {
        //   variables: {},
        //   secrets: {}
        // });

        // const wormhole = await runtime.usePlugin("@data-provider/wormhole", {
        //   variables: {},
        //   secrets: {}
        // });

        const providers: Record<string, PluginClient> = {
          "near_intents": nearIntents.client,
          "across": across.client,
          "layerzero": layerzero.client,
          // "lifi": lifi.client,
          // "axelar": axelar.client,
          "circle_cctp": circle_cctp.client,
          // "cbridge": cbridge.client,
          // "debridge": debridge.client,
          // "wormhole": wormhole.client,
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
