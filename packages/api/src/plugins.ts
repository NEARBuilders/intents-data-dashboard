import { createPluginRuntime } from "every-plugin";
import type AggregatorPlugin from "@data-provider/aggregator";
import type CanonicalAssetConversionPlugin from "@data-provider/canonical-asset-conversion";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof AggregatorPlugin;
    "@data-provider/canonical-asset-conversion": typeof CanonicalAssetConversionPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-742-data-provider-aggregator-data-pr-a7b37cf75-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/canonical-asset-conversion": "https://elliot-braem-739-data-provider-canonical-asset-co-2e1478526-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
    "@data-provider/canonical-asset-conversion": "http://localhost:3017/remoteEntry.js",
  }
} as const;

export async function initializePlugins(config: {
  secrets: {
    REDIS_URL: string,
    DUNE_API_KEY: string,
    NEAR_INTENTS_API_KEY: string,
    DATABASE_URL: string,
    DATABASE_AUTH_TOKEN: string
  },
  isDevelopment?: boolean,
  registry?: typeof PLUGIN_URLS
}) {
  const urls = (config.registry || PLUGIN_URLS)[config.isDevelopment ? 'development' : 'production'];

  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/aggregator": { remoteUrl: urls["@data-provider/aggregator"] },
      "@data-provider/canonical-asset-conversion": { remoteUrl: urls["@data-provider/canonical-asset-conversion"] },
    },
    secrets: config.secrets,
  });

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {
      isDevelopment: config.isDevelopment ?? false,
    },
    secrets: config.secrets,
  });

  const canonical = await runtime.usePlugin("@data-provider/canonical-asset-conversion", {
    variables: {},
    secrets: config.secrets,
  });

  return { runtime, aggregator, canonical } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
