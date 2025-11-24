import { Cache, Context, Effect, Layer } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import {
  assetToCanonicalIdentity,
  canonicalToAsset,
  getChainNamespace,
  getChainId,
} from "@data-provider/plugin-utils";
import type { AssetDescriptorType, CanonicalIdComponentsType } from "./contract";
import { AssetStore, type AssetCriteria } from "./store";
import { UniswapRegistry } from "./registries/uniswap";
import { CoingeckoRegistry } from "./registries/coingecko";
import { JupiterRegistry } from "./registries/jupiter";
import { BLOCKCHAIN_TO_CHAIN_ID, NON_EVM_BLOCKCHAINS } from "./blockchain-mapping";

export class CanonicalAssetService extends Context.Tag("CanonicalAssetService")<
  CanonicalAssetService,
  {
    readonly normalize: (descriptor: AssetDescriptorType) => Effect.Effect<AssetType, Error>;
    readonly fromCanonicalId: (assetId: string) => Effect.Effect<AssetType, Error>;
    readonly toCanonicalId: (
      blockchain: string,
      namespace: string,
      reference: string
    ) => Effect.Effect<string, Error>;
    readonly getBlockchains: () => Effect.Effect<
      Array<{
        blockchain: string;
        displayName: string;
        symbol: string;
        iconUrl?: string;
      }>,
      Error
    >;
    readonly getStoredAssets: () => Effect.Effect<AssetType[], Error>;
    readonly sync: () => Effect.Effect<{ uniswap: number; coingecko: number; jupiter: number }, Error>;
  }
>() {}

export const CanonicalAssetServiceLive = Layer.effect(
  CanonicalAssetService,
  Effect.gen(function* () {
    const store = yield* AssetStore;
    const uniswapRegistry = yield* UniswapRegistry;
    const coingeckoRegistry = yield* CoingeckoRegistry;
    const jupiterRegistry = yield* JupiterRegistry;

    const lookupCache = yield* Cache.make({
      capacity: 1000,
      timeToLive: "10 minutes",
      lookup: (key: string) =>
        Effect.gen(function* () {
          const criteria = JSON.parse(key) as AssetCriteria;
          return yield* resolveAsset(criteria);
        }),
    });

    const resolveAsset = (criteria: AssetCriteria): Effect.Effect<AssetType | null, Error> =>
      Effect.gen(function* () {
        const local = yield* store.find(criteria);
        if (local && local.decimals !== 0) {
          return local;
        }

        const uniswap = yield* uniswapRegistry.lookup(criteria);
        if (uniswap) {
          return uniswap;
        }

        const coingecko = yield* coingeckoRegistry.lookup(criteria);
        if (coingecko) {
          return coingecko;
        }

        const jupiter = yield* jupiterRegistry.lookup(criteria);
        if (jupiter) {
          return jupiter;
        }

        return null;
      });

    const getCachedAsset = (criteria: AssetCriteria): Effect.Effect<AssetType | null, Error> =>
      lookupCache.get(JSON.stringify(criteria));

    return {
      normalize: (descriptor) =>
        Effect.gen(function* () {
          const blockchain = descriptor.blockchain;

          let namespace = descriptor.namespace;
          let reference = descriptor.reference;

          if (!namespace || !reference) {
            const chainNs = getChainNamespace(blockchain, descriptor.reference);
            namespace = namespace || chainNs.namespace;
            reference = reference || chainNs.reference;
          }

          const identity = yield* Effect.tryPromise(() =>
            assetToCanonicalIdentity({ blockchain, namespace, reference })
          );

          let symbol = descriptor.symbol;
          let decimals = descriptor.decimals;
          let iconUrl: string | undefined;

          if (!symbol || decimals === undefined) {
            const criteria: AssetCriteria = {
              blockchain: identity.blockchain,
              reference: identity.reference,
              symbol: descriptor.symbol,
            };

            const asset = yield* getCachedAsset(criteria);

            if (asset) {
              symbol = symbol || asset.symbol;
              decimals = decimals ?? asset.decimals;
              iconUrl = iconUrl || asset.iconUrl;
            }
          }

          if (!symbol || decimals === undefined) {
            return yield* Effect.fail(
              new Error(`Cannot normalize asset: missing symbol or decimals for ${identity.assetId}`)
            );
          }

          const chainIdEffect = Effect.tryPromise(() => getChainId(identity.blockchain));
          const resolvedChainId = yield* chainIdEffect;
          const chainId = descriptor.chainId ?? resolvedChainId;

          return canonicalToAsset(identity, {
            symbol,
            decimals,
            iconUrl,
            chainId: chainId ?? undefined,
          });
        }),

      fromCanonicalId: (assetId) =>
        Effect.gen(function* () {
          const identity = yield* Effect.tryPromise(() => assetToCanonicalIdentity({ assetId }));

          const criteria: AssetCriteria = {
            assetId: identity.assetId,
            blockchain: identity.blockchain,
            reference: identity.reference,
          };

          const asset = yield* getCachedAsset(criteria);

          if (!asset || !asset.symbol || asset.decimals === undefined) {
            return yield* Effect.fail(
              new Error(`Cannot enrich asset ${assetId}: no metadata found`)
            );
          }

          const chainId = yield* Effect.tryPromise(() => getChainId(identity.blockchain));

          return canonicalToAsset(identity, {
            symbol: asset.symbol,
            decimals: asset.decimals,
            iconUrl: asset.iconUrl,
            chainId: chainId ?? undefined,
          });
        }),

      toCanonicalId: (blockchain, namespace, reference) =>
        Effect.tryPromise(() =>
          assetToCanonicalIdentity({ blockchain, namespace, reference }).then(
            (identity) => identity.assetId
          )
        ),

      getBlockchains: () =>
        Effect.gen(function* () {
          const evmBlockchains = [...new Set(Object.keys(BLOCKCHAIN_TO_CHAIN_ID))];
          const allBlockchains = [...evmBlockchains, ...NON_EVM_BLOCKCHAINS];

          const networks: Array<{
            blockchain: string;
            displayName: string;
            symbol: string;
            iconUrl?: string;
          }> = [];

          for (const blockchain of allBlockchains) {
            const criteria: AssetCriteria = {
              blockchain,
              reference: "coin",
            };

            const asset = yield* getCachedAsset(criteria).pipe(
              Effect.catchAll((error) => {
                console.error(`Failed to fetch metadata for blockchain ${blockchain}:`, error);
                return Effect.succeed(null);
              })
            );

            if (asset) {
              networks.push({
                blockchain,
                displayName: asset.symbol,
                symbol: asset.symbol,
                iconUrl: asset.iconUrl,
              });
            } else {
              networks.push({
                blockchain,
                displayName: blockchain.toUpperCase(),
                symbol: blockchain.toUpperCase(),
                iconUrl: undefined,
              });
            }
          }

          return networks;
        }),

      getStoredAssets: () =>
        Effect.gen(function* () {
          return yield* store.findMany({});
        }),

      sync: () =>
        Effect.gen(function* () {
          const uniswapCount = yield* uniswapRegistry.sync();
          const coingeckoCount = yield* coingeckoRegistry.sync();
          const jupiterCount = yield* jupiterRegistry.sync();

          return {
            uniswap: uniswapCount,
            coingecko: coingeckoCount,
            jupiter: jupiterCount,
          };
        }),
    };
  })
);
