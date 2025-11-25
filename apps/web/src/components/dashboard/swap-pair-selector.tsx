import {
  useAggregatorAssets,
  useBlockchains,
  type Network,
} from "@/lib/aggregator/hooks";
import { logEvent } from "@/lib/analytics";
import { Route } from "@/routes/_layout/swaps";
import type { Asset } from "@/types/common";
import { useEffect, useMemo, useState } from "react";
import { AssetSelect } from "./asset-select";
import { NetworkSelect } from "./network-select";

function getBlockchainsForSymbol(assets: Asset[], symbol: string): string[] {
  const upper = symbol.toUpperCase();
  const chains = new Set(
    assets
      .filter((a) => a.symbol.toUpperCase() === upper)
      .map((a) => a.blockchain)
      .filter(Boolean)
  );
  return Array.from(chains).sort();
}

export const SwapPairSelector = () => {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const { uniqueAssets, isLoading: assetsLoading } = useAggregatorAssets();
  const { data: canonicalNetworks, isLoading: networksLoading } =
    useBlockchains();

  const sourceAssetId = search.source;
  const destAssetId = search.destination;

  const sourceAssetFromUrl = useMemo(() => {
    if (!sourceAssetId) return null;
    return uniqueAssets.find((a) => a.assetId === sourceAssetId) ?? null;
  }, [sourceAssetId, uniqueAssets]);

  const destAssetFromUrl = useMemo(() => {
    if (!destAssetId) return null;
    return uniqueAssets.find((a) => a.assetId === destAssetId) ?? null;
  }, [destAssetId, uniqueAssets]);

  const effectiveSourceAsset = useMemo(() => {
    return sourceAssetFromUrl ?? uniqueAssets[0] ?? null;
  }, [sourceAssetFromUrl, uniqueAssets]);

  const effectiveDestAsset = useMemo(() => {
    return destAssetFromUrl ?? uniqueAssets[1] ?? uniqueAssets[0] ?? null;
  }, [destAssetFromUrl, uniqueAssets]);

  const networksByBlockchain = useMemo(() => {
    if (!canonicalNetworks) return new Map<string, Network>();
    return new Map(canonicalNetworks.map((n) => [n.blockchain, n]));
  }, [canonicalNetworks]);

  const sourceNetworks = useMemo(() => {
    if (!effectiveSourceAsset) return [];
    const blockchains = getBlockchainsForSymbol(
      uniqueAssets,
      effectiveSourceAsset.symbol
    );
    return blockchains.map(
      (chain) =>
        networksByBlockchain.get(chain) ?? {
          blockchain: chain,
          displayName: chain.charAt(0).toUpperCase() + chain.slice(1),
          symbol: chain,
        }
    );
  }, [uniqueAssets, effectiveSourceAsset, networksByBlockchain]);

  const destNetworks = useMemo(() => {
    if (!effectiveDestAsset) return [];
    const blockchains = getBlockchainsForSymbol(
      uniqueAssets,
      effectiveDestAsset.symbol
    );
    return blockchains.map(
      (chain) =>
        networksByBlockchain.get(chain) ?? {
          blockchain: chain,
          displayName: chain.charAt(0).toUpperCase() + chain.slice(1),
          symbol: chain,
        }
    );
  }, [uniqueAssets, effectiveDestAsset, networksByBlockchain]);

  const [selectedSourceNetwork, setSelectedSourceNetwork] = useState<string>(
    effectiveSourceAsset?.blockchain || ""
  );
  const [selectedDestNetwork, setSelectedDestNetwork] = useState<string>(
    effectiveDestAsset?.blockchain || ""
  );

  useEffect(() => {
    if (effectiveSourceAsset?.blockchain) {
      setSelectedSourceNetwork(effectiveSourceAsset.blockchain);
    }
  }, [effectiveSourceAsset?.blockchain]);

  useEffect(() => {
    if (effectiveDestAsset?.blockchain) {
      setSelectedDestNetwork(effectiveDestAsset.blockchain);
    }
  }, [effectiveDestAsset?.blockchain]);

  const sourceAssets = useMemo(() => {
    if (!selectedSourceNetwork) return uniqueAssets;
    return uniqueAssets.filter((a) => a.blockchain === selectedSourceNetwork);
  }, [uniqueAssets, selectedSourceNetwork]);

  const destAssets = useMemo(() => {
    if (!selectedDestNetwork) return uniqueAssets;
    return uniqueAssets.filter((a) => a.blockchain === selectedDestNetwork);
  }, [uniqueAssets, selectedDestNetwork]);

  const handleSourceNetworkChange = (blockchain: string) => {
    setSelectedSourceNetwork(blockchain);

    if (
      effectiveSourceAsset &&
      effectiveSourceAsset.blockchain !== blockchain
    ) {
      const assetOnNewNetwork = uniqueAssets.find(
        (a) =>
          a.symbol === effectiveSourceAsset.symbol &&
          a.blockchain === blockchain
      );
      if (assetOnNewNetwork) {
        navigate({
          search: (prev) => ({ ...prev, source: assetOnNewNetwork.assetId }),
        });
      } else {
        navigate({
          search: (prev) => ({ ...prev, source: undefined }),
        });
      }
    }
  };

  const handleDestNetworkChange = (blockchain: string) => {
    setSelectedDestNetwork(blockchain);

    if (effectiveDestAsset && effectiveDestAsset.blockchain !== blockchain) {
      const assetOnNewNetwork = uniqueAssets.find(
        (a) =>
          a.symbol === effectiveDestAsset.symbol && a.blockchain === blockchain
      );
      if (assetOnNewNetwork) {
        navigate({
          search: (prev) => ({
            ...prev,
            destination: assetOnNewNetwork.assetId,
          }),
        });
      } else {
        navigate({
          search: (prev) => ({ ...prev, destination: undefined }),
        });
      }
    }
  };

  const handleSourceAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === "") return;
    const asset = uniqueAssets.find((a: Asset) => a.assetId === assetId);
    if (asset) {
      navigate({
        search: (prev) => ({ ...prev, source: asset.assetId }),
      });
      if (asset && effectiveDestAsset) {
        logEvent({
          type: "route_selected",
          source: asset,
          destination: effectiveDestAsset,
        });
      }
    }
  };

  const handleDestAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === "") return;
    const asset = uniqueAssets.find((a: Asset) => a.assetId === assetId);
    if (asset) {
      navigate({
        search: (prev) => ({ ...prev, destination: asset.assetId }),
      });
      if (effectiveSourceAsset && asset) {
        logEvent({
          type: "route_selected",
          source: effectiveSourceAsset,
          destination: asset,
        });
      }
    }
  };

  useEffect(() => {
    if (!search.source && effectiveSourceAsset && !assetsLoading) {
      navigate({
        search: (prev) => ({ ...prev, source: effectiveSourceAsset.assetId }),
        replace: true,
      });
    }
  }, [search.source, effectiveSourceAsset, assetsLoading, navigate]);

  useEffect(() => {
    if (!search.destination && effectiveDestAsset && !assetsLoading) {
      navigate({
        search: (prev) => ({
          ...prev,
          destination: effectiveDestAsset.assetId,
        }),
        replace: true,
      });
    }
  }, [search.destination, effectiveDestAsset, assetsLoading, navigate]);

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
      <p className="text-base md:text-lg text-gray-300 text-center mb-6">
        Compare a cross-chain swap route between the selected platform and NEAR
        Intents.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-end">
        <div className="flex flex-col items-end gap-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">
            SWAP FROM
          </div>
          <NetworkSelect
            label=""
            value={selectedSourceNetwork}
            onChange={handleSourceNetworkChange}
            networks={sourceNetworks}
            disabled={sourceNetworks.length === 0}
          />

          <AssetSelect
            label=""
            value={effectiveSourceAsset?.assetId}
            onChange={handleSourceAssetChange}
            assets={sourceAssets}
            networkBlockchain={selectedSourceNetwork}
            direction="source"
            loading={assetsLoading}
            disabled={sourceAssets.length === 0}
          />
        </div>

        <div className="flex items-center justify-center py-4 sm:py-8">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="text-gray-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider">
            SWAP TO
          </div>
          <NetworkSelect
            label=""
            value={selectedDestNetwork}
            onChange={handleDestNetworkChange}
            networks={destNetworks}
            disabled={destNetworks.length === 0}
          />

          <AssetSelect
            label=""
            value={effectiveDestAsset?.assetId}
            onChange={handleDestAssetChange}
            assets={destAssets}
            networkBlockchain={selectedDestNetwork}
            direction="destination"
            loading={assetsLoading}
            disabled={destAssets.length === 0}
          />
        </div>
      </div>
    </div>
  );
};
