import { client } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import type { Asset } from "@/types/common";

export function useAggregatorListedAssets() {
  return useQuery({
    queryKey: ["aggregator-listed-assets"],
    queryFn: () => client.getListedAssets({ providers: undefined }),
    staleTime: 300_000,
  });
}

export function useCanonicalNetworks() {
  return useQuery({
    queryKey: ["canonical-networks"],
    queryFn: () => client.getNetworks(),
    staleTime: 3600_000,
  });
}

export interface Network {
  blockchain: string;
  displayName: string;
  symbol: string;
  iconUrl?: string;
}

export function useAggregatorAssets() {
  const { data: listed, isLoading: isLoadingAssets } = useAggregatorListedAssets();

  const allAssets: Asset[] = listed
    ? Object.values(listed.data).flat()
    : [];

  const assetsByAssetId = new Map<string, Asset>();
  for (const a of allAssets) {
    if (!assetsByAssetId.has(a.assetId)) {
      assetsByAssetId.set(a.assetId, a);
    }
  }

  const uniqueAssets = Array.from(assetsByAssetId.values());

  const supportedBlockchains = new Set(uniqueAssets.map((a) => a.blockchain));

  return {
    allAssets,
    uniqueAssets,
    supportedBlockchains,
    isLoading: isLoadingAssets,
  };
}

export function useSupportedNetworks() {
  const { data: networks, isLoading: isLoadingNetworks } = useCanonicalNetworks();
  const { supportedBlockchains, isLoading: isLoadingAssets } = useAggregatorAssets();

  const supportedNetworks = (networks ?? []).filter((n) =>
    supportedBlockchains.has(n.blockchain)
  );

  return {
    networks: supportedNetworks,
    isLoading: isLoadingNetworks || isLoadingAssets,
  };
}
