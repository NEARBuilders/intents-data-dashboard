import { createPluginRuntime } from "every-plugin";

// TODO: central in repository
const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-621-data-provider-aggregator-data-pr-05ae337d1-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
  }
} as const;

export async function initializePlugins(config: {
  secrets: { DUNE_API_KEY: string, NEAR_INTENTS_API_KEY: string },
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

  // @ts-ignore 
  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {},
    secrets: config.secrets,
  });

  return { runtime, aggregator } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
