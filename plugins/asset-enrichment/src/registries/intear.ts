import { Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { assetToCanonicalIdentity } from "@data-provider/plugin-utils";
import { AssetStore, type AssetCriteria } from "../store";

interface IntearTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  reference: string | null;
}

interface IntearToken {
  account_id: string;
  price_usd_raw?: string;
  price_usd?: string;
  metadata: IntearTokenMetadata;
  total_supply?: string;
  circulating_supply?: string;
  liquidity_usd?: number;
  volume_usd_24h?: number;
  [key: string]: unknown;
}

type IntearTokensResponse = Record<string, IntearToken>;

export class IntearRegistry extends Context.Tag("IntearRegistry")<
  IntearRegistry,
  {
    readonly sync: () => Effect.Effect<number, Error>;
    readonly lookup: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
  }
>() {}

export const IntearRegistryLive = Layer.effect(
  IntearRegistry,
  Effect.gen(function* () {
    const store = yield* AssetStore;

    const fetchAllTokens = (): Effect.Effect<IntearToken[], Error> =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch("https://prices.intear.tech/tokens");
          if (!response.ok) {
            const errorMsg = `Failed to fetch Intear tokens: ${response.status} ${response.statusText}`;
            console.error(`[AssetSync][Intear][error] msg=Failed to fetch tokens status=${response.status}`);
            throw new Error(errorMsg);
          }
          const data = (await response.json()) as IntearTokensResponse;
          return Object.values(data);
        },
        catch: (error) => {
          const errorMsg = `Intear fetch error: ${error}`;
          console.error(`[AssetSync][Intear][error] msg=${errorMsg}`);
          return new Error(errorMsg);
        },
      });

    const convertToAsset = (token: IntearToken): Effect.Effect<AssetType & { source: string; verified: boolean }, Error> =>
      Effect.gen(function* () {
        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain: "near",
            namespace: "nep141",
            reference: token.account_id,
          })
        );

        const decimals = token.metadata.decimals;
        if (typeof decimals !== 'number' || Number.isNaN(decimals)) {
          return yield* Effect.fail(
            new Error(`Invalid decimals for token ${token.account_id}: ${decimals}`)
          );
        }

        return {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          namespace: identity.namespace,
          reference: identity.reference,
          symbol: token.metadata.symbol.toUpperCase(),
          name: token.metadata.name,
          decimals,
          iconUrl: undefined,
          source: "intear",
          verified: true,
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          console.log("[AssetSync][Intear][start] target=All NEAR tokens from Intear");
          
          const tokens = yield* fetchAllTokens().pipe(
            Effect.catchAll((error) => {
              console.error("[AssetSync][Intear][error] msg=Failed to fetch tokens", error);
              return Effect.succeed([]);
            })
          );

          console.log(`[AssetSync][Intear][fetch-complete] tokensRetrieved=${tokens.length}`);

          let syncedCount = 0;
          const assets: (AssetType & { source: string; verified: boolean })[] = [];

          for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]!;
            
            if ((i + 1) % 100 === 0 || i === tokens.length - 1) {
              console.log(`[AssetSync][Intear][convert-progress] converted=${i + 1} total=${tokens.length}`);
            }

            const asset = yield* convertToAsset(token).pipe(
              Effect.catchAll((error) => {
                console.error(`[AssetSync][Intear][error] msg=Failed to convert token accountId=${token.account_id}`, error);
                return Effect.succeed(null);
              })
            );

            if (asset) {
              assets.push(asset);
            }
          }

          console.log(`[AssetSync][Intear][store-start] assets=${assets.length}`);
          for (let i = 0; i < assets.length; i++) {
            const asset = assets[i]!;
            
            if ((i + 1) % 100 === 0 || i === assets.length - 1) {
              console.log(`[AssetSync][Intear][store-progress] stored=${i + 1} total=${assets.length}`);
            }

            yield* store.upsert(asset).pipe(
              Effect.catchAll((error) => {
                console.error(`[AssetSync][Intear][error] msg=Failed to store token reference=${asset.reference}`, error);
                return Effect.void;
              })
            );
            syncedCount++;
          }

          console.log(`[AssetSync][Intear][complete] synced=${syncedCount}`);
          return syncedCount;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (criteria.blockchain?.toLowerCase() !== "near") {
            return null;
          }

          const local = yield* store.find(criteria);
          if (local && local.source === "intear" && local.decimals !== 0) {
            return local;
          }

          return null;
        }).pipe(Effect.catchAll(() => Effect.succeed(null))),
    };
  })
);
