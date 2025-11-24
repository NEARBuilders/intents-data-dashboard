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
          const response = await fetch(
            `https://api.nearblocks.io/v1/fts?${params}`
          );
          if (!response.ok) {
            const errorMsg = `Failed to fetch NearBlocks token list (page ${page}): ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          const data = (await response.json()) as NearBlocksTokenListResponse;
          return data.tokens || [];
        },
        catch: (error) => {
          const errorMsg = `NearBlocks fetch error (page ${page}): ${error}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        },
      });

    const fetchTokenDetail = (contract: string): Effect.Effect<NearBlocksToken, Error> =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetch(
            `https://api.nearblocks.io/v1/fts/${contract}`
          );
          if (!response.ok) {
            const errorMsg = `Failed to fetch NearBlocks token detail for ${contract}: ${response.status} ${response.statusText}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          return (await response.json()) as NearBlocksToken;
        },
        catch: (error) => {
          const errorMsg = `NearBlocks token detail error for ${contract}: ${error}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        },
      });

    const convertToAsset = (token: NearBlocksToken): Effect.Effect<AssetType & { source: string }, Error> =>
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
          iconUrl: token.icon,
          source: "nearblocks",
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          console.log("Starting NearBlocks sync: fetching top 5 pages (250 tokens)...");
          console.log("Note: Rate limited to 3 requests per minute");
          let totalSynced = 0;

          for (let page = 1; page <= 5; page++) {
            if (page > 3) {
              console.log(`NearBlocks: Waiting for rate limit before fetching page ${page}...`);
            } else {
              console.log(`NearBlocks: Fetching page ${page}...`);
            }

            const tokens = yield* rateLimiter(fetchTokenList(page, 50)).pipe(
              Effect.catchAll((error) => {
                console.error(`Failed to fetch page ${page}:`, error);
                return Effect.succeed([]);
              })
            );

            console.log(`NearBlocks page ${page}: Retrieved ${tokens.length} tokens`);

            // Convert all tokens to assets first
            const assets: (AssetType & { source: string })[] = [];
            for (let i = 0; i < tokens.length; i++) {
              const token = tokens[i]!;
              
              if ((i + 1) % 10 === 0 || i === tokens.length - 1) {
                console.log(`NearBlocks page ${page}: Converting token ${i + 1}/${tokens.length}...`);
              }

              const asset = yield* convertToAsset(token).pipe(
                Effect.catchAll((error) => {
                  console.error(`Failed to convert token ${token.contract}:`, error);
                  return Effect.succeed(null);
                })
              );

              if (asset) {
                assets.push(asset);
              }
            }

            // Batch upsert all assets
            console.log(`NearBlocks page ${page}: Upserting ${assets.length} assets to database...`);
            for (let i = 0; i < assets.length; i++) {
              const asset = assets[i]!;
              
              if ((i + 1) % 10 === 0 || i === assets.length - 1) {
                console.log(`NearBlocks page ${page}: Stored ${i + 1}/${assets.length} assets...`);
              }

              yield* store.upsert(asset).pipe(
                Effect.catchAll((error) => {
                  console.error(`Failed to store token ${asset.reference}:`, error);
                  return Effect.void;
                })
              );
              totalSynced++;
            }

            if (tokens.length < 50) {
              console.log(`Page ${page} returned fewer than 50 tokens, stopping pagination.`);
              break;
            }
          }

          console.log(`NearBlocks sync complete: ${totalSynced} tokens synced`);
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
