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
import { IntearRegistry } from "./registries/intear";
import { JupiterRegistry } from "./registries/jupiter";
import { NearBlocksRegistry } from "./registries/nearblocks";
import { UniswapRegistry } from "./registries/uniswap";
import { AssetStore, type AssetCriteria } from "./store";

export class AssetEnrichmentService extends Context.Tag("AssetEnrichmentService")<
  AssetEnrichmentService,
  {
    readonly enrich: (descriptor: AssetDescriptorType) => Effect.Effect<AssetType, Error>;
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
    readonly getSyncStatus: () => Effect.Effect<{
      status: 'idle' | 'running' | 'error';
      lastSuccessAt: number | null;
      lastErrorAt: number | null;
      errorMessage: string | null;
    }, Error>;
  }
>() { }

export const AssetEnrichmentServiceLive = Layer.effect(
  AssetEnrichmentService,
  Effect.gen(function* () {
    const store = yield* AssetStore;
    const uniswapRegistry = yield* UniswapRegistry;
    const coingeckoRegistry = yield* CoingeckoRegistry;
    const jupiterRegistry = yield* JupiterRegistry;
    const intearRegistry = yield* IntearRegistry;
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

        const intear = yield* intearRegistry.lookup(criteria);
        if (intear) {
          return intear;
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

    const enrichInternal = (
      identity: { assetId: string; blockchain: string; namespace: string; reference: string },
      descriptor?: Partial<AssetDescriptorType>
    ): Effect.Effect<AssetType, Error> =>
      Effect.gen(function* () {
        const criteria: AssetCriteria = {
          assetId: identity.assetId,
          blockchain: identity.blockchain,
          reference: identity.reference,
          symbol: descriptor?.symbol,
        };

        const local = yield* store.find(criteria);
        if (local && local.verified && local.decimals !== 0) {
          const chainId = local.chainId ?? getChainIdFromBlockchain(identity.blockchain) ?? undefined;
          return canonicalToAsset(identity, {
            symbol: local.symbol,
            decimals: local.decimals,
            iconUrl: local.iconUrl,
            chainId,
          });
        }

        const asset = yield* getCachedAsset(criteria);

        if (asset && asset.decimals !== 0) {
          const chainId = asset.chainId ?? getChainIdFromBlockchain(identity.blockchain) ?? undefined;
          return canonicalToAsset(identity, {
            symbol: asset.symbol,
            decimals: asset.decimals,
            iconUrl: asset.iconUrl,
            chainId,
          });
        }

        const fallbackReason =
          local && local.decimals === 0
            ? "local asset found but decimals is 0"
            : asset && asset.decimals === 0
              ? "registry asset found but decimals is 0"
              : "no asset metadata found in store or registries";

        const chainId = descriptor?.chainId ?? getChainIdFromBlockchain(identity.blockchain) ?? undefined;
        const fallbackSymbol = descriptor?.symbol || identity.blockchain.toUpperCase();
        const fallbackDecimals = 
          descriptor?.decimals ??
          (identity.namespace === 'erc20' || identity.namespace === 'native' ? 18 :
           identity.namespace === 'spl' ? 9 :
           identity.namespace === 'nep141' ? 24 : 0);

        console.warn("[AssetEnrichment] Using fallback metadata", {
          identity,
          criteria,
          descriptor,
          reason: fallbackReason,
          fallback: {
            symbol: fallbackSymbol,
            decimals: fallbackDecimals,
            chainId,
          },
        });

        const fallbackAsset = canonicalToAsset(identity, {
          symbol: fallbackSymbol,
          decimals: fallbackDecimals,
          iconUrl: descriptor?.symbol ? undefined : undefined,
          chainId,
        });

        yield* store.upsert({
          ...fallbackAsset,
          source: 'fallback',
          verified: false,
        });

        return fallbackAsset;
      });

    return {
      enrich: (descriptor: AssetDescriptorType) =>
        Effect.gen(function* () {
          const blockchain = descriptor.blockchain;

          let namespace = descriptor.namespace;
          let reference = descriptor.reference;

          if (!namespace || !reference) {
            const chainNs = getChainNamespace(blockchain, descriptor.reference);
            namespace = namespace || chainNs.namespace;
            reference = reference || chainNs.reference;
          }

          const identity = yield* Effect.tryPromise({
            try: () => assetToCanonicalIdentity({ blockchain, namespace, reference }),
            catch: (error) => {
              if (error instanceof Error) {
                return error;
              }
              return new Error(String(error));
            },
          });

          return yield* enrichInternal(identity, descriptor);
        }),

      fromCanonicalId: (assetId) =>
        Effect.gen(function* () {
          const identity = yield* Effect.tryPromise({
            try: () => assetToCanonicalIdentity({ assetId }),
            catch: (error) => {
              if (error instanceof Error) {
                return error;
              }
              return new Error(String(error));
            },
          });

          return yield* enrichInternal(identity);
        }),

      toCanonicalId: (blockchain, namespace, reference) =>
        Effect.tryPromise({
          try: () =>
            assetToCanonicalIdentity({ blockchain, namespace, reference }).then(
              (identity) => identity.assetId
            ),
          catch: (error) => {
            if (error instanceof Error) {
              return error;
            }
            return new Error(String(error));
          },
        }),

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
            yield* store.setSyncStatus('assets', 'running', null, null, null);
            console.log("Background sync started...");
            const startTime = Date.now();

            try {
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

              const intearCount = yield* intearRegistry.sync().pipe(
                Effect.catchAll((error) => {
                  console.error("Intear sync failed:", error);
                  return Effect.succeed(0);
                })
              );
              console.log(`Intear sync complete: ${intearCount} assets`);

              const nearBlocksCount = yield* nearBlocksRegistry.sync().pipe(
                Effect.catchAll((error) => {
                  console.error("NearBlocks sync failed:", error);
                  return Effect.succeed(0);
                })
              );
              console.log(`NearBlocks sync complete: ${nearBlocksCount} assets`);

              const duration = Date.now() - startTime;
              console.log(
                `Background sync complete! Total: ${uniswapCount + coingeckoCount + jupiterCount + intearCount + nearBlocksCount} assets in ${duration}ms`
              );

              yield* store.setSyncStatus('assets', 'idle', new Date(), null, null);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error("Sync failed with error:", errorMessage);
              yield* store.setSyncStatus('assets', 'error', null, new Date(), errorMessage);
            }
          });

          yield* Effect.forkDaemon(syncTask);

          return { status: "started" };
        }),

      getPrice: (assetId) =>
        Effect.gen(function* () {
          return yield* coingeckoRegistry.getPrice(assetId);
        }),

      getSyncStatus: () =>
        Effect.gen(function* () {
          return yield* store.getSyncStatus('assets');
        }),
    };
  })
);
