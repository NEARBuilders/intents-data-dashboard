import type { AssetType } from "@data-provider/shared-contract";
import type { ListedAssetsDataType } from "@data-provider/aggregator";

export type ProviderId = string;
export type Blockchain = string;

export interface ProviderAssetOnChain {
  providerId: ProviderId;
  asset: AssetType;
}

export interface SymbolGroup {
  symbol: string;
  iconUrl?: string;
  price?: number;
  providers: Record<ProviderId, Record<Blockchain, ProviderAssetOnChain>>;
  allBlockchains: Blockchain[];
  allProviders: ProviderId[];
}

interface StaticAssetsResponse {
  assets: Array<{
    symbol: string;
    image?: string;
    current_price?: number;
  }>;
}

export function buildSymbolGroups(
  listed: ListedAssetsDataType,
  staticAssets?: StaticAssetsResponse
): SymbolGroup[] {
  const map = new Map<string, SymbolGroup>();

  for (const [providerId, assets] of Object.entries(listed.data)) {
    for (const asset of assets) {
      const symbolKey = asset.symbol.toUpperCase();
      const blockchain = asset.blockchain || "unknown";

      let group = map.get(symbolKey);
      if (!group) {
        const cgAsset = staticAssets?.assets.find(
          (a) => a.symbol.toLowerCase() === asset.symbol.toLowerCase()
        );

        group = {
          symbol: asset.symbol,
          iconUrl: asset.iconUrl ?? cgAsset?.image,
          price: cgAsset?.current_price,
          providers: {},
          allBlockchains: [],
          allProviders: [],
        };
        map.set(symbolKey, group);
      }

      if (!group.providers[providerId]) {
        group.providers[providerId] = {};
      }
      group.providers[providerId][blockchain] = {
        providerId,
        asset,
      };
    }
  }

  for (const group of map.values()) {
    const blockchains = new Set<string>();
    const providers = new Set<string>();

    for (const [pid, chains] of Object.entries(group.providers)) {
      providers.add(pid);
      for (const chain of Object.keys(chains)) {
        blockchains.add(chain);
      }
    }

    group.allBlockchains = Array.from(blockchains).sort();
    group.allProviders = Array.from(providers).sort();
  }

  return Array.from(map.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );
}

export interface NetworkAvailability {
  blockchain: string;
  shared: boolean;
  assetsByProvider: Record<ProviderId, ProviderAssetOnChain | null>;
}

export function getNetworkAvailabilityForSymbol(
  group: SymbolGroup,
  providerA: string,
  providerB: string
): NetworkAvailability[] {
  const mapA = group.providers[providerA] ?? {};
  const mapB = group.providers[providerB] ?? {};

  const allChains = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

  const result: NetworkAvailability[] = [];

  for (const chain of allChains) {
    const assetA = mapA[chain] ?? null;
    const assetB = mapB[chain] ?? null;

    result.push({
      blockchain: chain,
      shared: !!assetA && !!assetB,
      assetsByProvider: {
        [providerA]: assetA,
        [providerB]: assetB,
      },
    });
  }

  return result.sort((a, b) => a.blockchain.localeCompare(b.blockchain));
}