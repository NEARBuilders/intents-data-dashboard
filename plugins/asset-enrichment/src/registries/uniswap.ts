import { Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { AssetStore, type AssetCriteria } from "../store";
import { assetToCanonicalIdentity, getBlockchainFromChainId, isEvmBlockchain } from "@data-provider/plugin-utils";

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
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        return (await response.json()) as UniswapTokenList;
      },
      catch: (error) => {
        const errorMsg = `Uniswap fetch error: ${error}`;
        console.error(errorMsg);
        return new Error(errorMsg);
      },
    });

    const convertToAsset = (token: UniswapToken): Effect.Effect<AssetType & { source: string }, Error> =>
      Effect.gen(function* () {
        const blockchain = getBlockchainFromChainId(token.chainId);
        if (!blockchain) {
          return yield* Effect.fail(new Error(`Unsupported chainId: ${token.chainId}`));
        }

        const identity = yield* Effect.tryPromise(() =>
          assetToCanonicalIdentity({
            blockchain,
            namespace: "erc20",
            reference: token.address.toLowerCase(),
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
        };
      });

    return {
      sync: () =>
        Effect.gen(function* () {
          const tokenList = yield* fetchTokenList;
          let syncedCount = 0;

          for (const token of tokenList.tokens) {
            const asset = yield* convertToAsset(token).pipe(
              Effect.catchAll(() => Effect.succeed(null))
            );
            
            if (asset) {
              yield* store.upsert(asset);
              syncedCount++;
            }
          }

          return syncedCount;
        }),

      lookup: (criteria) =>
        Effect.gen(function* () {
          if (!criteria.blockchain || !criteria.reference) {
            return null;
          }

          const blockchain = criteria.blockchain.toLowerCase();
          if (!isEvmBlockchain(blockchain)) {
            return null;
          }

          return yield* store.find(criteria);
        }),
    };
  })
);
