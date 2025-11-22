import { createPluginRuntime } from "every-plugin";
import type AggregatorPlugin from "@data-provider/aggregator";
import type NearIntentsPlugin from "@data-provider/near-intents";
import type AcrossPlugin from "@data-provider/across";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof AggregatorPlugin;
    "@data-provider/near-intents": typeof NearIntentsPlugin;
    "@data-provider/across": typeof AcrossPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-649-data-provider-aggregator-data-pr-0de871b8a-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/near-intents": "https://elliot-braem-610-data-provider-near-intents-data--5920f7dfd-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/across": "https://elliot-braem-609-data-provider-across-data-provid-001053a52-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
    "@data-provider/near-intents": "http://localhost:3015/remoteEntry.js",
    "@data-provider/across": "http://localhost:3016/remoteEntry.js",
  }
} as const;

export async function initializePlugins(config: {
  secrets: {
    REDIS_URL: string,
    DUNE_API_KEY: string,
    NEAR_INTENTS_API_KEY: string,
    COINMARKETCAP_API_KEY: string
  },
  isDevelopment?: boolean,
  registry?: typeof PLUGIN_URLS
}) {
  const urls = (config.registry || PLUGIN_URLS)[config.isDevelopment ? 'development' : 'production'];

  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/near-intents": { remoteUrl: urls["@data-provider/near-intents"] },
      "@data-provider/across": { remoteUrl: urls["@data-provider/across"] },
      "@data-provider/aggregator": { remoteUrl: urls["@data-provider/aggregator"] },
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

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {
      providers: {
        "near_intents": nearIntents.client,
        "across": across.client,
      }
    },
    secrets: config.secrets,
  });

  return { runtime, aggregator, nearIntents, across } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
