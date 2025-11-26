import { Context, Effect, Layer, RateLimiter } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { assetToCanonicalIdentity } from "@data-provider/plugin-utils";
import { AssetStore, type AssetCriteria } from "../store";

interface NearBlocksToken {
  contract: string;
  name: string;
  symbol: string;
  decimals: string;
  icon?: string;
  price?: string;
  market_cap?: string;
  onchain_market_cap?: string;
  total_supply?: string;
  circulating_supply?: string;
}

interface NearBlocksTokenListResponse {
  tokens: NearBlocksToken[];
}

export class NearBlocksRegistry extends Context.Tag("NearBlocksRegistry")<
  NearBlocksRegistry,
  {
    readonly sync: () => Effect.Effect<number, Error>;
    readonly lookup: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
  }
>() {}

export const NearBlocksRegistryLive = Layer.scoped(
  NearBlocksRegistry,
  Effect.gen(function* () {
    const store = yield* AssetStore;

    const rateLimiter = yield* RateLimiter.make({
      limit: 3,
      interval: "1 minutes",
    });

    const fetchTokenList = (
      page: number,
      perPage: number = 50
    ): Effect.Effect<NearBlocksToken[], Error> =>
      Effect.tryPromise({
        try: async () => {
          const params = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString(),
            sort: "onchain_market_cap",
            order: "desc",
          });

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(
              `https://api.nearblocks.io/v1/fts?${params}`,
              { signal: controller.signal }
            );
            if (!response.ok) {
              const errorMsg = `Failed to fetch NearBlocks token list (page ${page}): ${response.status} ${response.statusText}`;
              console.error(`[AssetSync][NearBlocks][error] msg=Failed to fetch page page=${page} status=${response.status}`);
              throw new Error(errorMsg);
            }
            const data = (await response.json()) as NearBlocksTokenListResponse;
            return data.tokens || [];
          } finally {
            clearTimeout(timeout);
          }
        },
        catch: (error) => {
          const errorMsg = error instanceof Error && error.name === 'AbortError'
            ? `NearBlocks fetch timeout (page ${page}): request exceeded 30s`
            : `NearBlocks fetch error (page ${page}): ${error}`;
          console.error(`[AssetSync][NearBlocks][error] msg=${errorMsg}`);
          return new Error(errorMsg);
        },
      });

    const fetchTokenDetail = (contract: string): Effect.Effect<NearBlocksToken, Error> =>
      Effect.tryPromise({
        try: async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(
              `https://api.nearblocks.io/v1/fts/${contract}`,
              { signal: controller.signal }
            );
            if (!response.ok) {
              const errorMsg = `Failed to fetch NearBlocks token detail for ${contract}: ${response.status} ${response.statusText}`;
              console.error(`[AssetSync][NearBlocks][error] msg=Failed to fetch token detail contract=${contract} status=${response.status}`);
              throw new Error(errorMsg);
            }
            return (await response.json()) as NearBlocksToken;
          } finally {
            clearTimeout(timeout);
          }
        },
        catch: (error) => {
          const errorMsg = error instanceof Error && error.name === 'AbortError'
            ? `NearBlocks token detail timeout for ${contract}: request exceeded 30s`
            : `NearBlocks token detail error for ${contract}: ${error}`;
          console.error(`[AssetSync][NearBlocks][error] msg=${errorMsg}`);
          return new Error(errorMsg);
        },
      });

    const convertToAsset = (token: NearBlocksToken): Effect.Effect<AssetType & { source: string; verified: boolean }, Error> =>
      Effect.gen(function* () {
        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain: "near",
            namespace: "nep141",
            reference: token.contract,
          })
        );

        const decimals = Number.parseInt(token.decimals, 10);
        if (Number.isNaN(decimals)) {
          return yield* Effect.fail(
            new Error(`Invalid decimals for token ${token.contract}: ${token.decimals}`)
          );
        }

        return {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          namespace: identity.namespace,
          reference: identity.reference,
          symbol: token.symbol.toUpperCase(),
          name: token.name,
          decimals,
          // nearblocks stores as a bunch of svgs...
          iconUrl: token.icon?.startsWith('data:') ? undefined : token.icon,
          source: "nearblocks",
          verified: true,
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          console.log("[AssetSync][NearBlocks][start] pages=3 pageSize=50 rateLimit=3/min");
          let totalSynced = 0;
          const syncStartTime = Date.now();

          for (let page = 1; page <= 3; page++) {
            const pageStartTime = Date.now();
            const elapsedSeconds = Math.floor((pageStartTime - syncStartTime) / 1000);
            
            console.log(`[AssetSync][NearBlocks][page-fetch-start] page=${page} elapsedSec=${elapsedSeconds}`);

            const tokens = yield* rateLimiter(fetchTokenList(page, 50)).pipe(
              Effect.catchAll((error) => {
                console.error(`[AssetSync][NearBlocks][error] msg=Failed to fetch page page=${page}`, error);
                return Effect.succeed([]);
              })
            );

            const pageFetchTime = Date.now();
            const fetchDuration = Math.floor((pageFetchTime - pageStartTime) / 1000);
            console.log(`[AssetSync][NearBlocks][page-fetch-end] page=${page} tokens=${tokens.length} fetchDurationSec=${fetchDuration}`);

            const assets: (AssetType & { source: string; verified: boolean })[] = [];
            for (let i = 0; i < tokens.length; i++) {
              const token = tokens[i]!;
              
              if ((i + 1) % 10 === 0 || i === tokens.length - 1) {
                console.log(`[AssetSync][NearBlocks][convert-progress] page=${page} converted=${i + 1} total=${tokens.length}`);
              }

              const asset = yield* convertToAsset(token).pipe(
                Effect.catchAll((error) => {
                  console.error(`[AssetSync][NearBlocks][error] msg=Failed to convert token contract=${token.contract}`, error);
                  return Effect.succeed(null);
                })
              );

              if (asset) {
                assets.push(asset);
              }
            }

            console.log(`[AssetSync][NearBlocks][store-start] page=${page} assets=${assets.length}`);
            for (let i = 0; i < assets.length; i++) {
              const asset = assets[i]!;
              
              if ((i + 1) % 10 === 0 || i === assets.length - 1) {
                console.log(`[AssetSync][NearBlocks][store-progress] page=${page} stored=${i + 1} total=${assets.length}`);
              }

              yield* store.upsert(asset).pipe(
                Effect.catchAll((error) => {
                  console.error(`[AssetSync][NearBlocks][error] msg=Failed to store token reference=${asset.reference}`, error);
                  return Effect.void;
                })
              );
              totalSynced++;
            }

            if (tokens.length < 50) {
              console.log(`[AssetSync][NearBlocks][early-stop] page=${page} tokensReturned=${tokens.length} reason=Less than page size`);
              break;
            }
          }

          console.log(`[AssetSync][NearBlocks][complete] totalSynced=${totalSynced}`);
          return totalSynced;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (criteria.blockchain?.toLowerCase() !== "near") {
            return null;
          }

          const local = yield* store.find(criteria);
          if (local && local.decimals !== 0) {
            return local;
          }

          if (!criteria.reference) {
            return null;
          }

          const token = yield* rateLimiter(fetchTokenDetail(criteria.reference));
          const asset = yield* convertToAsset(token);
          yield* store.upsert(asset);

          return asset;
        }).pipe(Effect.catchAll(() => Effect.succeed(null))),
    };
  })
)
