import { usePlatformsQuery, useTokensQuery } from "@/lib/coingecko/client";
import { tokenToAsset } from "@/lib/coingecko/assets";
import type { Asset } from "@/types/common";
import { useEffect, useMemo, useState } from "react";
import { NetworkSelect } from "./network-select";
import { AssetSelect } from "./asset-select";
import { logEvent } from "@/lib/analytics";

interface SwapPairSelectorProps {
  onPairChange: (source: Asset, destination: Asset) => void;
}

export const SwapPairSelector = ({ onPairChange }: SwapPairSelectorProps) => {
  const [sourceNetwork, setSourceNetwork] = useState<string | undefined>(
    undefined
  );
  const [sourceAsset, setSourceAsset] = useState<Asset | null>(null);
  const [destNetwork, setDestNetwork] = useState<string | undefined>(undefined);
  const [destAsset, setDestAsset] = useState<Asset | null>(null);

  const { data: platforms, isLoading: platformsLoading } = usePlatformsQuery();
  const { data: sourceTokens, isLoading: sourceTokensLoading } = useTokensQuery(sourceNetwork);
  const { data: destTokens, isLoading: destTokensLoading } = useTokensQuery(destNetwork);

  const sourceAssets = useMemo(() => {
    if (!sourceTokens || !sourceNetwork) return [];
    return sourceTokens
      .slice(0, 50)
      .map((token) => tokenToAsset(token, sourceNetwork))
      .filter((asset): asset is Asset => asset !== null);
  }, [sourceTokens, sourceNetwork]);

  const destAssets = useMemo(() => {
    if (!destTokens || !destNetwork) return [];
    return destTokens
      .slice(0, 50)
      .map((token) => tokenToAsset(token, destNetwork))
      .filter((asset): asset is Asset => asset !== null);
  }, [destTokens, destNetwork]);

  useEffect(() => {
    if (platforms && platforms.length > 0 && !sourceNetwork) {
      const ethereum = platforms.find((p) => p.id === "ethereum");
      if (ethereum) {
        setSourceNetwork(ethereum.id);
      } else {
        setSourceNetwork(platforms[0].id);
      }
    }
  }, [platforms, sourceNetwork]);

  useEffect(() => {
    if (platforms && platforms.length > 0 && !destNetwork) {
      const arbitrum = platforms.find((p) => p.id === "arbitrum-one");
      if (arbitrum) {
        setDestNetwork(arbitrum.id);
      } else if (platforms.length > 1) {
        setDestNetwork(platforms[1].id);
      }
    }
  }, [platforms, destNetwork]);

  useEffect(() => {
    if (sourceAssets.length > 0 && !sourceAsset) {
      const usdc = sourceAssets.find(
        (a) => a.symbol === "USDC" || a.symbol.includes("USD")
      );
      const asset = usdc || sourceAssets[0];
      setSourceAsset(asset);
    }
  }, [sourceAssets, sourceAsset]);

  useEffect(() => {
    if (destAssets.length > 0 && !destAsset) {
      const usdc = destAssets.find(
        (a) => a.symbol === "USDC" || a.symbol.includes("USD")
      );
      const asset = usdc || destAssets[0];
      setDestAsset(asset);
    }
  }, [destAssets, destAsset]);

  useEffect(() => {
    if (sourceAsset && destAsset) {
      onPairChange(sourceAsset, destAsset);
    }
  }, [sourceAsset, destAsset, onPairChange]);

  const handleSourceNetworkChange = (networkId: string) => {
    setSourceNetwork(networkId);
    setSourceAsset(null);
  };

  const handleSourceAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === '') return;
    const asset = sourceAssets.find((a) => a.assetId === assetId);
    if (asset) {
      setSourceAsset(asset);
    }
  };

  const handleDestNetworkChange = (networkId: string) => {
    setDestNetwork(networkId);
    setDestAsset(null);
  };

  const handleDestAssetChange = (assetId: string) => {
    if (!assetId || assetId.trim() === '') return;
    const asset = destAssets.find((a) => a.assetId === assetId);
    if (asset) {
      setDestAsset(asset);
    }
  };

  useEffect(() => {
    if (sourceAsset && destAsset) {
      logEvent({
        type: "route_selected",
        source: sourceAsset,
        destination: destAsset,
      });
    }
  }, [sourceAsset, destAsset]);

  const selectedSourcePlatform = platforms?.find((p) => p.id === sourceNetwork);
  const selectedDestPlatform = platforms?.find((p) => p.id === destNetwork);

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
              value={sourceNetwork}
              onChange={handleSourceNetworkChange}
              platforms={platforms}
            />

            <AssetSelect
              label=""
              value={sourceAsset?.assetId}
              onChange={handleSourceAssetChange}
              assets={sourceAssets}
              tokens={sourceTokens}
              networkId={sourceNetwork}
              direction="source"
              loading={sourceTokensLoading}
              disabled={sourceAssets.length === 0}
            />
          </div>

          <div className="space-y-4">
            <NetworkSelect
              label="SWAP TO"
              value={destNetwork}
              onChange={handleDestNetworkChange}
              platforms={platforms}
            />

            <AssetSelect
              label=""
              value={destAsset?.assetId}
              onChange={handleDestAssetChange}
              assets={destAssets}
              tokens={destTokens}
              networkId={destNetwork}
              direction="destination"
              loading={destTokensLoading}
              disabled={destAssets.length === 0}
            />
          </div>
        </div>

        {sourceAsset && destAsset && (
          <div className="mt-6 p-4 bg-[#1a1a1a] rounded-lg border border-[#343434]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Selected Route:</span>
              <span className="text-white font-medium">
                {sourceAsset.symbol} on {selectedSourcePlatform?.name} →{" "}
                {destAsset.symbol} on {selectedDestPlatform?.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
