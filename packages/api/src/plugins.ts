import type DataProviderTemplatePlugin from "@data-provider/template";
import type DataAggregatorPlugin from "@data-provider/aggregator";
import { createPluginRuntime } from "every-plugin";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/aggregator": typeof DataAggregatorPlugin;
  }
}

const PLUGIN_URLS = {
  production: {
    "@data-provider/aggregator": "https://elliot-braem-591-data-provider-aggregator-data-pr-d89e5d1a2-ze.zephyrcloud.app/remoteEntry.js",
  },
  development: {
    "@data-provider/aggregator": "http://localhost:3014/remoteEntry.js",
  }
} as const;

const isDevelopment = false;
const urls = isDevelopment ? PLUGIN_URLS.development : PLUGIN_URLS.production;

const env = {
  DUNE_API_KEY: process.env.DUNE_API_KEY!,
  NEAR_INTENTS_API_KEY: process.env.NEAR_INTENTS_API_KEY || ""
};

export const runtime = createPluginRuntime({
  registry: {
    "@data-provider/aggregator": { remoteUrl: urls["@data-provider/aggregator"] },
  },
  secrets: env,
});

const aggregator = await runtime.usePlugin("@data-provider/aggregator", {
  variables: {
  },
  secrets: {
    DUNE_API_KEY: "{{DUNE_API_KEY}}"
  },
});

export const plugins = {
  aggregator,
} as const;
