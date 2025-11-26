import { Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { AssetStore, type AssetCriteria } from "../store";
import { assetToCanonicalIdentity, getBlockchainFromChainId, normalizeBlockchainSlug, isZeroAddress, getChainNamespace } from "@data-provider/plugin-utils";

interface UniswapToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface UniswapTokenList {
  name: string;
  tokens: UniswapToken[];
}

export class UniswapRegistry extends Context.Tag("UniswapRegistry")<
  UniswapRegistry,
  {
    readonly sync: () => Effect.Effect<number, Error>;
    readonly lookup: (criteria: AssetCriteria) => Effect.Effect<AssetType | null, Error>;
  }
>() {}

export const UniswapRegistryLive = Layer.effect(
  UniswapRegistry,
  Effect.gen(function* () {
    const store = yield* AssetStore;

    const fetchTokenList = Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://tokens.uniswap.org");
        if (!response.ok) {
          const errorMsg = `Failed to fetch Uniswap token list: ${response.status} ${response.statusText}`;
          console.error(`[AssetSync][Uniswap][error] msg=Failed to fetch token list status=${response.status}`);
          throw new Error(errorMsg);
        }
        return (await response.json()) as UniswapTokenList;
      },
      catch: (error) => {
        const errorMsg = `Uniswap fetch error: ${error}`;
        console.error(`[AssetSync][Uniswap][error] msg=${errorMsg}`);
        return new Error(errorMsg);
      },
    });

    const convertToAsset = (token: UniswapToken): Effect.Effect<AssetType & { source: string; verified: boolean }, Error> =>
      Effect.gen(function* () {
        const blockchain = getBlockchainFromChainId(token.chainId);
        if (!blockchain) {
          return yield* Effect.fail(new Error(`Unsupported chainId: ${token.chainId}`));
        }

        const { namespace, reference } = getChainNamespace(blockchain, token.address.toLowerCase());

        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain,
            namespace,
            reference
          })
        );

        return {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          namespace: identity.namespace,
          reference: identity.reference,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          iconUrl: token.logoURI,
          chainId: token.chainId,
          source: "uniswap",
          verified: true,
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          const tokenList = yield* fetchTokenList;
          const totalTokens = tokenList.tokens.length;
          let syncedCount = 0;
          let processedCount = 0;

          console.log(`[AssetSync][Uniswap][start] totalTokens=${totalTokens}`);

          for (const token of tokenList.tokens) {
            processedCount++;

            if (isZeroAddress(token.address)) {
              continue;
            }

            const asset = yield* convertToAsset(token).pipe(
              Effect.catchAll((error) => {
                console.error(`[AssetSync][Uniswap][error] msg=Failed to convert token address=${token.address}`, error);
                return Effect.succeed(null);
              })
            );
            
            if (asset) {
              yield* store.upsert(asset).pipe(
                Effect.catchAll((error) => {
                  console.error(`[AssetSync][Uniswap][error] msg=Failed to store token reference=${asset.reference}`, error);
                  return Effect.void;
                })
              );
              syncedCount++;
            }

            if (processedCount % 250 === 0) {
              console.log(`[AssetSync][Uniswap][progress] processed=${processedCount} total=${totalTokens} synced=${syncedCount}`);
            }
          }

          console.log(`[AssetSync][Uniswap][complete] synced=${syncedCount} total=${totalTokens}`);
          return syncedCount;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (!criteria.blockchain || !criteria.reference) {
            return null;
          }

          const normalizedCriteria = {
            ...criteria,
            blockchain: normalizeBlockchainSlug(criteria.blockchain.toLowerCase()),
            reference: criteria.reference.toLowerCase(),
          };

          return yield* store.find(normalizedCriteria);
        }),
    };
  })
);
