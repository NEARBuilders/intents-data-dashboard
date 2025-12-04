import AggregatorPlugin from "@data-provider/aggregator";
import { createPluginRuntime } from 'every-plugin';

// necessary for type portability
import * as _ZodTypes from "every-plugin/zod/v4/core";

export async function initializePlugins(config: {
  secrets: {
    REDIS_URL: string,
    DUNE_API_KEY: string,
    NEAR_INTENTS_API_KEY: string,
  },
}) {
  const runtime = createPluginRuntime({
    registry: {
      "@data-provider/aggregator": { module: AggregatorPlugin },
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
