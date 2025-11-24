import { Effect } from "every-plugin/effect";
import type { AssetType } from "@data-provider/shared-contract";
import { 
  assetToCanonicalIdentity,
  canonicalToAsset,
  getChainNamespace,
  getChainId 
} from "@data-provider/plugin-utils";
import type { RegistryClient } from "./registries/types";
import type { 
  AssetDescriptorType, 
  CanonicalIdComponentsType 
} from "./contract";

export class CanonicalAssetService {
  constructor(private registry: RegistryClient) {}

  normalize(descriptor: AssetDescriptorType): Effect.Effect<AssetType, Error> {
    return Effect.gen(this, function* () {
      const blockchain = descriptor.blockchain;
      
      let namespace = descriptor.namespace;
      let reference = descriptor.reference;

      if (!namespace || !reference) {
        const chainNs = getChainNamespace(blockchain, descriptor.reference);
        namespace = namespace || chainNs.namespace;
        reference = reference || chainNs.reference;
      }

      const identityEffect = Effect.promise(() => 
        assetToCanonicalIdentity({ blockchain, namespace, reference })
      );
      const identity = yield* identityEffect;

      let symbol = descriptor.symbol;
      let decimals = descriptor.decimals;
      let iconUrl: string | undefined;

      const isNative = identity.reference === 'coin';

      if (!symbol || !decimals) {
        const metadataEffect = isNative 
          ? Effect.promise(() => this.registry.getNativeCoin(identity.blockchain))
          : Effect.promise(() => this.registry.findByReference(identity.blockchain, identity.reference));

        const metadata = yield* metadataEffect;

        if (metadata) {
          symbol = symbol || metadata.symbol;
          decimals = decimals ?? metadata.decimals;
          iconUrl = metadata.iconUrl;
        }
      }

      if (!symbol || decimals === undefined) {
        return yield* Effect.fail(
          new Error(`Cannot normalize asset: missing symbol or decimals for ${identity.assetId}`)
        );
      }

      const chainIdEffect = Effect.promise(() => getChainId(identity.blockchain));
      const resolvedChainId = yield* chainIdEffect;
      const chainId = descriptor.chainId ?? resolvedChainId;

      return canonicalToAsset(identity, {
        symbol,
        decimals,
        iconUrl,
        chainId: chainId ?? undefined,
      });
    });
  }

  fromCanonicalId(assetId: string): Effect.Effect<AssetType, Error> {
    return Effect.gen(this, function* () {
      const identityEffect = Effect.promise(() => 
        assetToCanonicalIdentity({ assetId })
      );
      const identity = yield* identityEffect;

      const isNative = identity.reference === 'coin';

      const metadataEffect = isNative
        ? Effect.promise(() => this.registry.getNativeCoin(identity.blockchain))
        : Effect.promise(() => this.registry.findByReference(identity.blockchain, identity.reference));

      const metadata = yield* metadataEffect;

      if (!metadata || !metadata.symbol || metadata.decimals === undefined) {
        return yield* Effect.fail(
          new Error(`Cannot enrich asset ${assetId}: registry returned incomplete metadata`)
        );
      }

      const chainIdEffect = Effect.promise(() => getChainId(identity.blockchain));
      const chainId = yield* chainIdEffect;

      return canonicalToAsset(identity, {
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        iconUrl: metadata.iconUrl,
        chainId: chainId ?? undefined,
      });
    });
  }

  toCanonicalId(
    blockchain: string,
    namespace: string,
    reference: string
  ): Effect.Effect<string, Error> {
    return Effect.tryPromise(() => 
      assetToCanonicalIdentity({ blockchain, namespace, reference })
        .then(identity => identity.assetId)
    );
  }

  getNetworks(): Effect.Effect<Array<{
    blockchain: string;
    displayName: string;
    symbol: string;
    iconUrl?: string;
  }>, Error> {
    return Effect.gen(this, function* () {
      const BLOCKCHAIN_SLUGS = [
        'eth', 'btc', 'sol', 'near', 'arb', 'op', 'base', 
        'pol', 'bsc', 'ton', 'aptos', 'sui', 'avax', 'ftm', 'celo'
      ];

      const results: Array<{
        blockchain: string;
        displayName: string;
        symbol: string;
        iconUrl?: string;
      }> = [];

      for (const blockchain of BLOCKCHAIN_SLUGS) {
        try {
          const metadataEffect = Effect.promise(() => 
            this.registry.getNativeCoin(blockchain)
          );
          const metadata = yield* metadataEffect;

          if (metadata && metadata.symbol && metadata.name) {
            results.push({
              blockchain,
              displayName: metadata.name,
              symbol: metadata.symbol,
              iconUrl: metadata.iconUrl,
            });
          }
        } catch (error) {
          console.warn(`[CanonicalAssetService] Failed to get network metadata for ${blockchain}:`, error);
        }
      }

      return results;
    });
  }
}
