import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createProviderRouter } from "@data-provider/plugin-utils";
import { IntentsClient } from "./client";
import { contract } from "@data-provider/shared-contract";
import { IntentsService } from "./service";

export default createPlugin({
  variables: z.object({
    baseUrl: z.url().default("https://1click.chaindefuser.com"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
    apiKey: z.string().optional(), // JWT for 1Click and Explorer APIs
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create HTTP client for both APIs
      const client = new IntentsClient(
        config.variables.baseUrl,
        "https://explorer.near-intents.org",
        config.secrets.apiKey,
        config.variables.timeout
      );

      // Create service instance
      const service = new IntentsService(client);

      // Pre-populate asset cache to enable our canonical cache (because near intents asset ids are hard to reverse map)
      yield* Effect.gen(function* () {
        console.log("[NEAR Intents] Warming asset cache...");
        
        const assets = yield* Effect.tryPromise({
          try: () => service.getListedAssets(),
          catch: (error) => new Error(`Failed to fetch assets: ${error}`)
        });
        
        let successCount = 0;
        let failCount = 0;
        
        yield* Effect.forEach(
          assets,
          (asset) => Effect.tryPromise({
            try: async () => {
              await service.transformAssetFromProvider(asset);
              successCount++;
            },
            catch: (error) => {
              failCount++;
              console.warn(`[NEAR Intents] Failed to transform asset ${asset.symbol}, ${asset.intentsAssetId}:`, error);
              return error;
            }
          }).pipe(Effect.catchAll(() => Effect.void)),
          { concurrency: "unbounded" }
        );
        
        console.log(`[NEAR Intents] Asset cache warmed: ${successCount} assets mapped, ${failCount} failed`);
      }).pipe(
        Effect.catchAll((error) => {
          console.error("[NEAR Intents] Failed to warm asset cache:", error);
          return Effect.void;
        })
      );

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return createProviderRouter(service, builder);
  }
});
