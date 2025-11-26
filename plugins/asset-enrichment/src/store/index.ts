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
    readonly upsert: (asset: AssetType & { source: string; verified: boolean }) => Effect.Effect<void, Error>;
    readonly find: (criteria: AssetCriteria) => Effect.Effect<(AssetType & { verified: boolean; source: string }) | null, Error>;
    readonly findMany: (criteria: AssetCriteria) => Effect.Effect<AssetType[], Error>;
    readonly delete: (assetId: string) => Effect.Effect<void, Error>;
    readonly setSyncStatus: (
      id: string,
      status: 'idle' | 'running' | 'error',
      lastSuccessAt: Date | null,
      lastErrorAt: Date | null,
      errorMessage: string | null
    ) => Effect.Effect<void, Error>;
    readonly getSyncStatus: (id: string) => Effect.Effect<{
      status: 'idle' | 'running' | 'error';
      lastSuccessAt: number | null;
      lastErrorAt: number | null;
      errorMessage: string | null;
    }, Error>;
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
                blockchain: asset.blockchain.toLowerCase(),
                namespace: asset.namespace,
                reference: asset.reference.toLowerCase(),
                symbol: asset.symbol,
                name: asset.name || asset.symbol,
                decimals: asset.decimals,
                iconUrl: asset.iconUrl || null,
                chainId: asset.chainId || null,
                source: asset.source,
                verified: asset.verified,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: schema.assets.id,
                set: {
                  blockchain: asset.blockchain.toLowerCase(),
                  namespace: asset.namespace,
                  reference: asset.reference.toLowerCase(),
                  symbol: asset.symbol,
                  name: asset.name || asset.symbol,
                  decimals: asset.decimals,
                  iconUrl: asset.iconUrl || null,
                  chainId: asset.chainId || null,
                  source: asset.source,
                  verified: asset.verified,
                  updatedAt: new Date(),
                },
              });
          },
          catch: (error) => new Error(`Failed to upsert asset: ${error}`),
        }),

      find: (criteria) =>
        Effect.tryPromise({
          try: async () => {
            // Priority 1: assetId (most specific)
            if (criteria.assetId) {
              const results = await db
                .select()
                .from(schema.assets)
                .where(eq(schema.assets.id, criteria.assetId))
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
                name: row.name || undefined,
                decimals: row.decimals,
                iconUrl: row.iconUrl || undefined,
                chainId: row.chainId || undefined,
                verified: row.verified,
                source: row.source,
              };
            }

            // Priority 2: reference (address) - the unique identifier
            // Optional filter by blockchain if provided
            if (criteria.reference) {
              const conditions = [eq(schema.assets.reference, criteria.reference.toLowerCase())];
              
              if (criteria.blockchain) {
                conditions.push(eq(schema.assets.blockchain, criteria.blockchain.toLowerCase()));
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
                name: row.name || undefined,
                decimals: row.decimals,
                iconUrl: row.iconUrl || undefined,
                chainId: row.chainId || undefined,
                verified: row.verified,
                source: row.source,
              };
            }

            // Fallback: symbol only (least specific)
            if (criteria.symbol) {
              const results = await db
                .select()
                .from(schema.assets)
                .where(eq(schema.assets.symbol, criteria.symbol))
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
                name: row.name || undefined,
                decimals: row.decimals,
                iconUrl: row.iconUrl || undefined,
                chainId: row.chainId || undefined,
                verified: row.verified,
                source: row.source,
              };
            }

            return null;
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
              name: row.name || undefined,
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

      setSyncStatus: (id, status, lastSuccessAt, lastErrorAt, errorMessage) =>
        Effect.tryPromise({
          try: async () => {
            await db
              .insert(schema.syncState)
              .values({
                id,
                status,
                lastSuccessAt: lastSuccessAt || null,
                lastErrorAt: lastErrorAt || null,
                errorMessage: errorMessage || null,
              })
              .onConflictDoUpdate({
                target: schema.syncState.id,
                set: {
                  status,
                  lastSuccessAt: lastSuccessAt || null,
                  lastErrorAt: lastErrorAt || null,
                  errorMessage: errorMessage || null,
                },
              });
          },
          catch: (error) => new Error(`Failed to set sync status: ${error}`),
        }),

      getSyncStatus: (id) =>
        Effect.tryPromise({
          try: async () => {
            const results = await db
              .select()
              .from(schema.syncState)
              .where(eq(schema.syncState.id, id))
              .limit(1);

            if (results.length === 0) {
              return {
                status: 'idle' as const,
                lastSuccessAt: null,
                lastErrorAt: null,
                errorMessage: null,
              };
            }

            const row = results[0]!;
            return {
              status: row.status as 'idle' | 'running' | 'error',
              lastSuccessAt: row.lastSuccessAt ? Math.floor(row.lastSuccessAt.getTime() / 1000) : null,
              lastErrorAt: row.lastErrorAt ? Math.floor(row.lastErrorAt.getTime() / 1000) : null,
              errorMessage: row.errorMessage,
            };
          },
          catch: (error) => new Error(`Failed to get sync status: ${error}`),
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
