import { createPluginRuntime } from "every-plugin";
import type AssetEnrichmentPlugin from "@data-provider/asset-enrichment";

declare module "every-plugin" {
  interface RegisteredPlugins {
    "@data-provider/asset-enrichment": typeof AssetEnrichmentPlugin;
  }
}

export async function initializePlugins(config: {
  secrets: {
    DATABASE_URL: string;
    DATABASE_AUTH_TOKEN?: string;
  };
  remoteUrl: string;
}) {
  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/asset-enrichment": { remoteUrl: config.remoteUrl },
    },
    secrets: config.secrets,
  });

  const canonical = await runtime.usePlugin("@data-provider/asset-enrichment", {
    variables: {},
    secrets: config.secrets,
  });

  return { runtime, canonical } as const;
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
