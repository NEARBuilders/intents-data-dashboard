import type CanonicalAssetPlugin from "@data-provider/canonical-asset-conversion";
import { createPluginRuntime } from "every-plugin";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/canonical-asset-conversion": typeof CanonicalAssetPlugin;
  }
}

// Plugin URL configurations
const PLUGIN_URLS = {
  development: "http://localhost:3014/remoteEntry.js",
  production: process.env.CANONICAL_PLUGIN_URL || "http://localhost:3014/remoteEntry.js"
} as const;

const isDevelopment = process.env.NODE_ENV === 'development';
const pluginUrl = isDevelopment ? PLUGIN_URLS.development : PLUGIN_URLS.production;

export const runtime = createPluginRuntime({
  registry: {
    "@data-provider/canonical-asset-conversion": {
      remoteUrl: pluginUrl
    }
  }
});

// Initialize the canonical asset plugin
const canonicalAsset = await runtime.usePlugin("@data-provider/canonical-asset-conversion", {
  variables: {},
  secrets: {}
});

export const plugins = {
  canonicalAsset
} as const;
