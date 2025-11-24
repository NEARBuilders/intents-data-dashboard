import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { migrate } from "drizzle-orm/libsql/migrator";

import { contract } from "./contract";
import { CanonicalAssetService, CanonicalAssetServiceLive } from "./service";
import { DatabaseLive, AssetStoreLive } from "./store";
import { UniswapRegistryLive } from "./registries/uniswap";
import { CoingeckoRegistryLive } from "./registries/coingecko";
import { JupiterRegistryLive } from "./registries/jupiter";

/**
 * Canonical Asset Conversion Plugin
 *
 * Central registry and conversion service for canonical 1cs_v1 asset identifiers.
 * Integrates with Uniswap, CoinGecko, and Jupiter to enrich asset metadata.
 *
 * Features:
 * - Normalize arbitrary asset descriptors into canonical Asset format
 * - Parse 1cs_v1 IDs and enrich with registry data (symbol, decimals, iconUrl)
 * - Build canonical 1cs_v1 IDs from blockchain/namespace/reference
 * - Local SQLite cache with hot Effect.Cache layer
 * - Multi-source registry fallback (Uniswap -> CoinGecko -> Jupiter)
 * - Manual sync endpoint for registry data updates
 */
export default createPlugin({
  variables: z.object({
    SYNC_ON_STARTUP: z.boolean().default(false),
  }),

  secrets: z.object({
    DATABASE_URL: z.string().default("file:./canonical-assets.db"),
    DATABASE_AUTH_TOKEN: z.string().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const dbLayer = DatabaseLive(config.secrets.DATABASE_URL, config.secrets.DATABASE_AUTH_TOKEN);
      
      const AppLayer = CanonicalAssetServiceLive.pipe(
        Layer.provide(UniswapRegistryLive),
        Layer.provide(CoingeckoRegistryLive),
        Layer.provide(JupiterRegistryLive),
        Layer.provide(AssetStoreLive),
        Layer.provide(dbLayer)
      );

      const { createDatabase } = require("./db");
      const db = createDatabase(config.secrets.DATABASE_URL, config.secrets.DATABASE_AUTH_TOKEN);

      yield* Effect.tryPromise({
        try: () =>
          migrate(db, {
            migrationsFolder: "./src/db/migrations",
          }),
        catch: (error) => new Error(`Migration failed: ${error}`),
      });

      console.log("Canonical Asset Conversion plugin initialized");

      return { appLayer: AppLayer };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    return {
      normalize: builder.normalize.handler(async ({ input }) => {
        return await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.normalize(input);
          }).pipe(Effect.provide(context.appLayer))
        );
      }),

      fromCanonicalId: builder.fromCanonicalId.handler(async ({ input }) => {
        return await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.fromCanonicalId(input.assetId);
          }).pipe(Effect.provide(context.appLayer))
        );
      }),

      toCanonicalId: builder.toCanonicalId.handler(async ({ input }) => {
        const assetId = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.toCanonicalId(input.blockchain, input.namespace, input.reference);
          }).pipe(Effect.provide(context.appLayer))
        );
        return { assetId };
      }),

      getBlockchains: builder.getBlockchains.handler(async () => {
        return await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.getBlockchains();
          }).pipe(Effect.provide(context.appLayer))
        );
      }),

      getStoredAssets: builder.getStoredAssets.handler(async () => {
        return await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.getStoredAssets();
          }).pipe(Effect.provide(context.appLayer))
        );
      }),

      sync: builder.sync.handler(async () => {
        return await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* CanonicalAssetService;
            return yield* service.sync();
          }).pipe(Effect.provide(context.appLayer))
        );
      }),

      ping: builder.ping.handler(async () => {
        return {
          status: 'ok' as const,
          timestamp: new Date().toISOString(),
        };
      }),
    };
  },
});
