import { Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { eq, and } from "drizzle-orm";
import type { Database as DrizzleDatabase } from "../db";
import * as schema from "../db/schema";

export interface AssetCriteria {
  blockchain?: string;
  reference?: string;
  symbol?: string;
  assetId?: string;
}

export class AssetStore extends Context.Tag("AssetStore")<
  AssetStore,
  {
    readonly upsert: (asset: AssetType & { source: string }) => Effect.Effect<void, Error>;
    readonly find: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
    readonly findMany: (criteria: AssetCriteria) => Effect.Effect<AssetType[], Error>;
    readonly delete: (assetId: string) => Effect.Effect<void, Error>;
  }
>() {}

export const AssetStoreLive = Layer.effect(
  AssetStore,
  Effect.gen(function* () {
    const db = yield* Database;

    return {
      upsert: (asset) =>
        Effect.tryPromise({
          try: async () => {
            await db
              .insert(schema.assets)
              .values({
                id: asset.assetId,
                blockchain: asset.blockchain,
                namespace: asset.namespace,
                reference: asset.reference,
                symbol: asset.symbol,
                name: asset.symbol,
                decimals: asset.decimals,
                iconUrl: asset.iconUrl || null,
                chainId: asset.chainId || null,
                source: asset.source,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: schema.assets.id,
                set: {
                  symbol: asset.symbol,
                  decimals: asset.decimals,
                  iconUrl: asset.iconUrl || null,
                  chainId: asset.chainId || null,
                  source: asset.source,
                  updatedAt: new Date(),
                },
              });
          },
          catch: (error) => new Error(`Failed to upsert asset: ${error}`),
        }),

      find: (criteria) =>
        Effect.tryPromise({
          try: async () => {
            const conditions = [];

            if (criteria.assetId) {
              conditions.push(eq(schema.assets.id, criteria.assetId));
            } else {
              if (criteria.blockchain) {
                conditions.push(eq(schema.assets.blockchain, criteria.blockchain));
              }
              if (criteria.reference) {
                conditions.push(eq(schema.assets.reference, criteria.reference));
              }
              if (criteria.symbol) {
                conditions.push(eq(schema.assets.symbol, criteria.symbol));
              }
            }

            if (conditions.length === 0) {
              return null;
            }

            const results = await db
              .select()
              .from(schema.assets)
              .where(and(...conditions))
              .limit(1);

            if (results.length === 0) {
              return null;
            }

            const row = results[0]!;
            return {
              assetId: row.id,
              blockchain: row.blockchain,
              namespace: row.namespace,
              reference: row.reference,
              symbol: row.symbol,
              decimals: row.decimals,
              iconUrl: row.iconUrl || undefined,
              chainId: row.chainId || undefined,
            } satisfies AssetType;
          },
          catch: (error) => new Error(`Failed to find asset: ${error}`),
        }),

      findMany: (criteria) =>
        Effect.tryPromise({
          try: async () => {
            const conditions = [];

            if (criteria.blockchain) {
              conditions.push(eq(schema.assets.blockchain, criteria.blockchain));
            }
            if (criteria.symbol) {
              conditions.push(eq(schema.assets.symbol, criteria.symbol));
            }

            const query =
              conditions.length > 0
                ? db.select().from(schema.assets).where(and(...conditions))
                : db.select().from(schema.assets);

            const results = await query;

            return results.map((row) => ({
              assetId: row.id,
              blockchain: row.blockchain,
              namespace: row.namespace,
              reference: row.reference,
              symbol: row.symbol,
              decimals: row.decimals,
              iconUrl: row.iconUrl || undefined,
              chainId: row.chainId || undefined,
            })) satisfies AssetType[];
          },
          catch: (error) => new Error(`Failed to find assets: ${error}`),
        }),

      delete: (assetId) =>
        Effect.tryPromise({
          try: async () => {
            await db.delete(schema.assets).where(eq(schema.assets.id, assetId));
          },
          catch: (error) => new Error(`Failed to delete asset: ${error}`),
        }),
    };
  })
);

export class Database extends Context.Tag("Database")<Database, DrizzleDatabase>() {}

export const DatabaseLive = (url: string, authToken?: string) =>
  Layer.sync(Database, () => {
    const { createDatabase } = require("../db");
    return createDatabase(url, authToken);
  });
