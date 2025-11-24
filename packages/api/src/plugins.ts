import { createPluginRuntime } from "every-plugin";
import type AggregatorPlugin from "@data-provider/aggregator";
import type CanonicalAssetConversionPlugin from "@data-provider/asset-enrichment";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof AggregatorPlugin;
    "@data-provider/asset-enrichment": typeof CanonicalAssetConversionPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-767-data-provider-aggregator-data-pr-8a82e525d-ze.zephyrcloud.app/remoteEntry.js",
    "@data-provider/asset-enrichment": "https://elliot-braem-764-data-provider-canonical-asset-co-a70517e4e-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
    "@data-provider/asset-enrichment": "http://localhost:3017/remoteEntry.js",
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
      "@data-provider/asset-enrichment": { remoteUrl: urls["@data-provider/asset-enrichment"] },
    },
    secrets: config.secrets,
  });

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {
      isDevelopment: config.isDevelopment ?? false,
    },
    secrets: config.secrets,
  });

  const canonical = await runtime.usePlugin("@data-provider/asset-enrichment", {
    variables: {},
    secrets: config.secrets,
  });

  return { runtime, aggregator, canonical } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
