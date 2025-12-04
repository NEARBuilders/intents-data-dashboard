import { client, assetEnrichmentClient } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Asset } from "@/types/common";
import type { ProviderIdentifier } from "@data-provider/aggregator";

export function useListedAssets(providers?: ProviderIdentifier[]) {
  return useQuery({
    queryKey: ["listed-assets", providers],
    queryFn: () => client.getListedAssets({ providers }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => client.getProviders(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useBlockchains() {
  return useQuery({
    queryKey: ["blockchains"],
    queryFn: () => assetEnrichmentClient.getBlockchains(),
    staleTime: 3600_000,
  });
}

export interface Network {
  blockchain: string;
  displayName: string;
  symbol: string;
  iconUrl?: string;
}

export interface UiAsset {
  asset: Asset;
  providers: ProviderIdentifier[];
}

function isNativeAsset(asset: Asset): boolean {
  return asset.namespace === 'native' || asset.reference === 'coin';
}

function sortAssetsByNativeFirst(assets: UiAsset[]): UiAsset[] {
  return assets.sort((a, b) => {
    const aIsNative = isNativeAsset(a.asset);
    const bIsNative = isNativeAsset(b.asset);
    
    if (aIsNative && !bIsNative) return -1;
    if (!aIsNative && bIsNative) return 1;
    
    return a.asset.symbol.localeCompare(b.asset.symbol);
  });
}

export function useCanonicalAssets(providers: ProviderIdentifier[] = ["near_intents", "across"]) {
  const { data: listed, isLoading, error } = useListedAssets(providers);

  const processedAssets = useMemo(() => {
    if (!listed) {
      return {
        byChain: new Map<string, UiAsset[]>(),
        byId: new Map<string, UiAsset>(),
        chains: [],
      };
    }

    const byId = new Map<string, UiAsset>();
    const byChain = new Map<string, UiAsset[]>();

    for (const [providerId, assets] of Object.entries(listed.data)) {
      for (const asset of assets) {
        if (!asset.assetId?.startsWith("1cs_v1:")) continue;

        const existing = byId.get(asset.assetId);
        if (existing) {
          if (!existing.providers.includes(providerId as ProviderIdentifier)) {
            existing.providers.push(providerId as ProviderIdentifier);
          }
        } else {
          const uiAsset: UiAsset = {
            asset,
            providers: [providerId as ProviderIdentifier],
          };
          byId.set(asset.assetId, uiAsset);

          const chain = asset.blockchain;
          if (!byChain.has(chain)) {
            byChain.set(chain, []);
          }
          byChain.get(chain)!.push(uiAsset);
        }
      }
    }

    for (const [, list] of byChain) {
      sortAssetsByNativeFirst(list);
    }

    const chains = Array.from(byChain.keys()).sort();

    return { byChain, byId, chains };
  }, [listed]);

  return {
    ...processedAssets,
    isLoading,
    error,
  };
}

export function useAggregatorAssets() {
  const { data: listed, isLoading: isLoadingAssets } = useListedAssets();

  const allAssets: Asset[] = listed
    ? Object.values(listed.data).flat()
    : [];

  const assetsByAssetId = new Map<string, Asset>();
  for (const a of allAssets) {
    if (!assetsByAssetId.has(a.assetId)) {
      assetsByAssetId.set(a.assetId, a);
    }
  }

  const uniqueAssets = Array.from(assetsByAssetId.values()).sort((a, b) => {
    const aIsNative = isNativeAsset(a);
    const bIsNative = isNativeAsset(b);
    
    if (aIsNative && !bIsNative) return -1;
    if (!aIsNative && bIsNative) return 1;
    
    return a.symbol.localeCompare(b.symbol);
  });

  const supportedBlockchains = new Set(uniqueAssets.map((a) => a.blockchain));

  return {
    allAssets,
    uniqueAssets,
    supportedBlockchains,
    isLoading: isLoadingAssets,
  };
}

export function useSupportedNetworks() {
  const { data: networks, isLoading: isLoadingNetworks } = useBlockchains();
  const { supportedBlockchains, isLoading: isLoadingAssets } = useAggregatorAssets();

  const supportedNetworks = (networks ?? []).filter((n: Network) =>
    supportedBlockchains.has(n.blockchain)
  );

  return {
    networks: supportedNetworks,
    isLoading: isLoadingNetworks || isLoadingAssets,
  };
}
