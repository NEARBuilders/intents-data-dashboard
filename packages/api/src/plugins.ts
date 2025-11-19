import type DataAggregatorPlugin from "@data-provider/aggregator";
import { createPluginRuntime } from "every-plugin";
import { apiEnv } from "./env";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof DataAggregatorPlugin;
  }
}

// TODO: central in repository
const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-600-data-provider-aggregator-data-pr-c4fedde8e-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
  }
} as const;

export async function initializePlugins(config?: {
  isDevelopment?: boolean,
  registry?: typeof PLUGIN_URLS
}) {
  const urls = (config?.registry || PLUGIN_URLS)[config?.isDevelopment ? 'development' : 'production'];
  
  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/aggregator": { remoteUrl: urls["@data-provider/aggregator"] },
    },
    secrets: { DUNE_API_KEY: apiEnv.DUNE_API_KEY },
  });

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {},
    secrets: {
      DUNE_API_KEY: apiEnv.DUNE_API_KEY
    },
  });

  return { runtime, aggregator } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
