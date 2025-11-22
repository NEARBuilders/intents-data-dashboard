import { usePlatforms, useTopAssetsForPlatform } from "@/hooks/use-static-assets";
import type { Asset } from "@/types/common";
import type { EnrichedAsset } from "@/lib/coingecko/types";
import { useMemo, useState, useEffect } from "react";
import { NetworkSelect } from "./network-select";
import { AssetSelect } from "./asset-select";
import { logEvent } from "@/lib/analytics";
import { Route } from "@/routes/_layout/swaps";
import { assetTo1cs, parse1csToAsset } from "@/lib/1cs-utils";
import { getDefaultSourceNetwork, getDefaultDestNetwork } from "@/store/swap";

export const SwapPairSelector = () => {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();
  
  const sourceFrom1cs = search.source ? parse1csToAsset(search.source) : null;
  const destFrom1cs = search.destination ? parse1csToAsset(search.destination) : null;
  
  const [manualSourceNetwork, setManualSourceNetwork] = useState<string | undefined>(undefined);
  const [manualDestNetwork, setManualDestNetwork] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (sourceFrom1cs?.blockchain) {
      setManualSourceNetwork(undefined);
    }
  }, [sourceFrom1cs?.blockchain]);

  useEffect(() => {
    if (destFrom1cs?.blockchain) {
      setManualDestNetwork(undefined);
    }
  }, [destFrom1cs?.blockchain]);
  
  const effectiveSourceNetwork = manualSourceNetwork ?? sourceFrom1cs?.blockchain ?? getDefaultSourceNetwork(platforms);
  const effectiveDestNetwork = manualDestNetwork ?? destFrom1cs?.blockchain ?? getDefaultDestNetwork(platforms);

  const { data: sourceTopAssets, isLoading: sourceAssetsLoading } = useTopAssetsForPlatform(effectiveSourceNetwork);
  const { data: destTopAssets, isLoading: destAssetsLoading } = useTopAssetsForPlatform(effectiveDestNetwork);

  const marketCoinToAsset = (coin: EnrichedAsset, blockchainId: string): Asset | null => {
    const contractAddress = coin.platforms[blockchainId];
    
    return {
      blockchain: blockchainId,
      assetId: coin.id,
      symbol: coin.symbol.toUpperCase(),
      decimals: undefined,
      contractAddress: contractAddress || undefined,
      iconUrl: coin.image,
    };
  };

  const sourceAssets = useMemo(() => {
    if (!sourceTopAssets || !effectiveSourceNetwork) return [];
    return sourceTopAssets.map((coin: EnrichedAsset) => marketCoinToAsset(coin, effectiveSourceNetwork)).filter((a): a is Asset => a !== null);
  }, [sourceTopAssets, effectiveSourceNetwork]);

  const destAssets = useMemo(() => {
    if (!destTopAssets || !effectiveDestNetwork) return [];
    return destTopAssets.map((coin: EnrichedAsset) => marketCoinToAsset(coin, effectiveDestNetwork)).filter((a): a is Asset => a !== null);
  }, [destTopAssets, effectiveDestNetwork]);

  const effectiveSourceAsset = useMemo(() => {
    if (sourceFrom1cs?.assetId) {
      const found = sourceAssets.find(a => assetTo1cs(a) === sourceFrom1cs.assetId);
      if (found) return found;
    }
    return sourceAssets[0] ?? null;
  }, [sourceAssets, sourceFrom1cs]);

  const effectiveDestAsset = useMemo(() => {
    if (destFrom1cs?.assetId) {
      const found = destAssets.find(a => assetTo1cs(a) === destFrom1cs.assetId);
      if (found) return found;
    }
    return destAssets[0] ?? null;
  }, [destAssets, destFrom1cs]);

  const handleSourceNetworkChange = (networkId: string) => {
    setManualSourceNetwork(networkId);
    navigate({
      search: (prev) => ({ ...prev, source: undefined })
    });
  };

  const handleSourceAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === '') return;
    const asset = sourceAssets.find((a: Asset) => a.assetId === assetId);
    if (asset) {
      const id1cs = assetTo1cs(asset);
      navigate({
        search: (prev) => ({ ...prev, source: id1cs })
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

  const handleDestNetworkChange = (networkId: string) => {
    setManualDestNetwork(networkId);
    navigate({
      search: (prev) => ({ ...prev, destination: undefined })
    });
  };

  const handleDestAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === '') return;
    const asset = destAssets.find((a: Asset) => a.assetId === assetId);
    if (asset) {
      const id1cs = assetTo1cs(asset);
      navigate({
        search: (prev) => ({ ...prev, destination: id1cs })
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

  const selectedSourcePlatform = platforms?.find((p) => p.id === effectiveSourceNetwork);
  const selectedDestPlatform = platforms?.find((p) => p.id === effectiveDestNetwork);

  if (platformsLoading) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
        <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-6">
          <div className="flex items-center justify-center h-32">
            <span className="text-white text-sm">Loading platforms...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
      <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-6">
        <h3 className="font-medium text-white text-xl mb-6">
          Compare a cross-chain swap route between the selected platform and
          NEAR Intents.
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <NetworkSelect
              label="SWAP FROM"
              value={effectiveSourceNetwork}
              onChange={handleSourceNetworkChange}
              platforms={platforms}
            />

            <AssetSelect
              label=""
              value={effectiveSourceAsset?.assetId}
              onChange={handleSourceAssetChange}
              assets={sourceAssets}
              tokens={sourceTopAssets}
              networkId={effectiveSourceNetwork}
              direction="source"
              loading={sourceAssetsLoading}
              disabled={sourceAssets.length === 0}
            />
          </div>

          <div className="space-y-4">
            <NetworkSelect
              label="SWAP TO"
              value={effectiveDestNetwork}
              onChange={handleDestNetworkChange}
              platforms={platforms}
            />

            <AssetSelect
              label=""
              value={effectiveDestAsset?.assetId}
              onChange={handleDestAssetChange}
              assets={destAssets}
              tokens={destTopAssets}
              networkId={effectiveDestNetwork}
              direction="destination"
              loading={destAssetsLoading}
              disabled={destAssets.length === 0}
            />
          </div>
        </div>

        {effectiveSourceAsset && effectiveDestAsset && (
          <div className="mt-6 p-4 bg-[#1a1a1a] rounded-lg border border-[#343434]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Selected Route:</span>
              <span className="text-white font-medium">
                {effectiveSourceAsset.symbol} on {selectedSourcePlatform?.name} →{" "}
                {effectiveDestAsset.symbol} on {selectedDestPlatform?.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
