import { createPluginRuntime } from "every-plugin";
import type AggregatorPlugin from "@data-provider/aggregator";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof AggregatorPlugin;
  }
}

const PLUGIN_URLS = {
  "@data-provider/aggregator": "https://elliot-braem-932-data-provider-aggregator-data-pr-585f55fda-ze.zephyrcloud.app/remoteEntry.js",
} as const;

export async function initializePlugins(config: {
  secrets: {
    REDIS_URL: string,
    DUNE_API_KEY: string,
    NEAR_INTENTS_API_KEY: string,
    ASSET_ENRICHMENT_URL: string,
  },
}) {
  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/aggregator": { remoteUrl: PLUGIN_URLS["@data-provider/aggregator"] },
    },
    secrets: config.secrets,
  });

  const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
    variables: {},
    secrets: config.secrets,
  });

  return { runtime, aggregator } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
