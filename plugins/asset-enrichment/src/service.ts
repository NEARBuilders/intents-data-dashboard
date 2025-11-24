import {
  assetToCanonicalIdentity,
  canonicalToAsset,
  getChainIdFromBlockchain,
  getChainNamespace,
  normalizeBlockchainSlug,
   BLOCKCHAIN_TO_CHAIN_ID,
   NON_EVM_BLOCKCHAINS
} from "@data-provider/plugin-utils";
import type { AssetType } from "@data-provider/shared-contract";
import { Cache, Context, Effect, Layer } from "every-plugin/effect";
import type { AssetDescriptorType } from "./contract";
import { CoingeckoRegistry } from "./registries/coingecko";
import { JupiterRegistry } from "./registries/jupiter";
import { NearBlocksRegistry } from "./registries/nearblocks";
import { UniswapRegistry } from "./registries/uniswap";
import { AssetStore, type AssetCriteria } from "./store";

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
    readonly sync: () => Effect.Effect<{ status: string }, Error>;
    readonly getPrice: (assetId: string) => Effect.Effect<{ price: number | null; timestamp: number | null }, Error>;
  }
>() { }

export const CanonicalAssetServiceLive = Layer.effect(
  CanonicalAssetService,
  Effect.gen(function* () {
    const store = yield* AssetStore;
    const uniswapRegistry = yield* UniswapRegistry;
    const coingeckoRegistry = yield* CoingeckoRegistry;
    const jupiterRegistry = yield* JupiterRegistry;
    const nearBlocksRegistry = yield* NearBlocksRegistry;

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

        const nearBlocks = yield* nearBlocksRegistry.lookup(criteria);
        if (nearBlocks) {
          return nearBlocks;
        }

        return null;
      });

    const getCachedAsset = (criteria: AssetCriteria): Effect.Effect<AssetType | null, Error> => {
      const normalizedCriteria = {
        ...criteria,
        blockchain: criteria.blockchain ? normalizeBlockchainSlug(criteria.blockchain) : undefined,
        reference: criteria.reference ? criteria.reference.toLowerCase() : undefined,
      };
      return lookupCache.get(JSON.stringify(normalizedCriteria));
    };

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

          const chainId = descriptor.chainId ?? getChainIdFromBlockchain(identity.blockchain) ?? undefined;

          return canonicalToAsset(identity, {
            symbol,
            decimals,
            iconUrl,
            chainId,
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

          const chainId = asset.chainId ?? getChainIdFromBlockchain(identity.blockchain) ?? undefined;

          return canonicalToAsset(identity, {
            symbol: asset.symbol,
            decimals: asset.decimals,
            iconUrl: asset.iconUrl,
            chainId,
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
                displayName: asset.name || asset.symbol,
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
          const syncTask = Effect.gen(function* () {
            console.log("Background sync started...");
            const startTime = Date.now();

            const uniswapCount = yield* uniswapRegistry.sync().pipe(
              Effect.catchAll((error) => {
                console.error("Uniswap sync failed:", error);
                return Effect.succeed(0);
              })
            );
            console.log(`Uniswap sync complete: ${uniswapCount} assets`);

            const coingeckoCount = yield* coingeckoRegistry.sync().pipe(
              Effect.catchAll((error) => {
                console.error("CoinGecko sync failed:", error);
                return Effect.succeed(0);
              })
            );
            console.log(`CoinGecko sync complete: ${coingeckoCount} assets`);

            const jupiterCount = yield* jupiterRegistry.sync().pipe(
              Effect.catchAll((error) => {
                console.error("Jupiter sync failed:", error);
                return Effect.succeed(0);
              })
            );
            console.log(`Jupiter sync complete: ${jupiterCount} assets`);

            const nearBlocksCount = yield* nearBlocksRegistry.sync().pipe(
              Effect.catchAll((error) => {
                console.error("NearBlocks sync failed:", error);
                return Effect.succeed(0);
              })
            );
            console.log(`NearBlocks sync complete: ${nearBlocksCount} assets`);

            const duration = Date.now() - startTime;
            console.log(
              `Background sync complete! Total: ${uniswapCount + coingeckoCount + jupiterCount + nearBlocksCount} assets in ${duration}ms`
            );
          });

          yield* Effect.forkDaemon(syncTask);

          return { status: "started" };
        }),

      getPrice: (assetId) =>
        Effect.gen(function* () {
          return yield* coingeckoRegistry.getPrice(assetId);
        }),
    };
  })
);
