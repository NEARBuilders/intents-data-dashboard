import { createPluginRuntime } from "every-plugin";
import type AggregatorPlugin from "@data-provider/aggregator";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof AggregatorPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-863-data-provider-aggregator-data-pr-ed938ca47-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
  }
} as const;

export async function initializePlugins(config: {
  secrets: {
    REDIS_URL: string,
    DUNE_API_KEY: string,
    NEAR_INTENTS_API_KEY: string,
    ASSET_ENRICHMENT_URL: string,
  },
  isDevelopment?: boolean,
  registry?: typeof PLUGIN_URLS
}) {
  const urls = (config.registry || PLUGIN_URLS)[config.isDevelopment ? 'development' : 'production'];

  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/aggregator": { remoteUrl: urls["@data-provider/aggregator"] },
    },
    secrets: config.secrets,
  });

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {
      isDevelopment: config.isDevelopment ?? false,
    },
    secrets: config.secrets,
  });

  return { runtime, aggregator } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
