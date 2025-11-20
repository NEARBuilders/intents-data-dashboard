import { createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";
import type DataProviderPlugin from "@data-provider/template";

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

export function initializeProviderRuntime(config: {
  NEAR_INTENTS_API_KEY: string
}) {
  return Effect.gen(function* () {
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
            NEAR_INTENTS_API_KEY: config.NEAR_INTENTS_API_KEY
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

    return {
      runtime,
      providers: {
        "near_intents": nearIntents.client,
        "across": across.client,
      }
    };
  });
}
