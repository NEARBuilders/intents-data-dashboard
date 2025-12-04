import { Effect } from 'every-plugin/effect';
import AcrossPlugin from "@data-provider/across";
import CCTPPlugin from "@data-provider/cctp";
import LayerZeroPlugin from "@data-provider/layerzero";
import NearIntentsPlugin from "@data-provider/near-intents";
import type { PluginClient } from "@data-provider/shared-contract";
import { createPluginRuntime } from "every-plugin";

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
        const runtime = createPluginRuntime({
          registry: {
            "@data-provider/near-intents": { module: NearIntentsPlugin },
            "@data-provider/across": { module: AcrossPlugin },
            "@data-provider/layerzero": { module: LayerZeroPlugin },
            "@data-provider/cctp": { module: CCTPPlugin },
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
      catch: (error: unknown) => new Error(`Failed to initialize plugin runtime: ${error}`)
    }),
    ({ runtime }) => Effect.sync(() => {
      if (runtime && typeof runtime.shutdown === 'function') {
        runtime.shutdown();
      }
    })
  );
}
