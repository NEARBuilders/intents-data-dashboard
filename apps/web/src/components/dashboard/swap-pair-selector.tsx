import { Input } from "@/components/ui/input";
import {
  useBlockchains,
  useCanonicalAssets,
  type Network,
} from "@/lib/aggregator/hooks";
import { logEvent } from "@/lib/analytics";
import { Route } from "@/routes/_layout/swaps";
import {
  amountAtom,
  compareEnabledAtom,
  destAssetAtom,
  selectedProviderAtom,
  sourceAssetAtom,
} from "@/store/swap";
import type { ProviderIdentifier } from "@data-provider/aggregator/src/contract";
import { useAtom } from "@effect-atom/atom-react";
import { useEffect, useMemo, useState } from "react";
import { AssetSelect } from "./asset-select";
import { NetworkSelect } from "./network-select";
import { Button } from "../ui/button";

export const SwapPairSelector = () => {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [selectedProvider] = useAtom(selectedProviderAtom);
  const [sourceAsset, setSourceAsset] = useAtom(sourceAssetAtom);
  const [destAsset, setDestAsset] = useAtom(destAssetAtom);
  const [amount, setAmount] = useAtom(amountAtom);
  const [compareEnabled, setCompareEnabled] = useAtom(compareEnabledAtom);

  const handleCompare = () => {
    setCompareEnabled(true);
  };

  const providers: ProviderIdentifier[] = useMemo(() => {
    const providerList: ProviderIdentifier[] = ["near_intents"];
    if (selectedProvider && selectedProvider !== "near_intents") {
      providerList.push(selectedProvider as ProviderIdentifier);
    }
    return providerList;
  }, [selectedProvider]);

  const {
    byChain,
    byId,
    chains,
    isLoading: assetsLoading,
  } = useCanonicalAssets(providers);
  const { data: allNetworks, isLoading: networksLoading } = useBlockchains();

  const [selectedFromChain, setSelectedFromChain] = useState<string>("");
  const [selectedToChain, setSelectedToChain] = useState<string>("");

  const fromAssets = useMemo(() => {
    return byChain.get(selectedFromChain) || [];
  }, [byChain, selectedFromChain]);

  const toAssets = useMemo(() => {
    return byChain.get(selectedToChain) || [];
  }, [byChain, selectedToChain]);

  const networksForFromChain = useMemo(() => {
    if (!allNetworks) return [];
    return allNetworks.filter((n: Network) => chains.includes(n.blockchain));
  }, [allNetworks, chains]);

  const networksForToChain = useMemo(() => {
    if (!allNetworks) return [];
    return allNetworks.filter((n: Network) => chains.includes(n.blockchain));
  }, [allNetworks, chains]);

  const sourceAssetId = search.source;
  const destAssetId = search.destination;

  const selectedFromAsset = useMemo(() => {
    if (!sourceAssetId) return null;
    return byId.get(sourceAssetId)?.asset ?? null;
  }, [sourceAssetId, byId]);

  const selectedToAsset = useMemo(() => {
    if (!destAssetId) return null;
    return byId.get(destAssetId)?.asset ?? null;
  }, [destAssetId, byId]);

  useEffect(() => {
    if (selectedFromAsset) {
      setSelectedFromChain(selectedFromAsset.blockchain);
    } else if (!selectedFromChain && chains.length > 0) {
      const defaultChain = chains.find((c) => c === "eth") || chains[0];
      setSelectedFromChain(defaultChain);
    }
  }, [selectedFromAsset, selectedFromChain, chains]);

  useEffect(() => {
    if (selectedToAsset) {
      setSelectedToChain(selectedToAsset.blockchain);
    } else if (!selectedToChain && chains.length > 0) {
      const defaultChain =
        chains.find((c) => c === "arbitrum") || chains[1] || chains[0];
      setSelectedToChain(defaultChain);
    }
  }, [selectedToAsset, selectedToChain, chains]);

  useEffect(() => {
    setSourceAsset(selectedFromAsset);
  }, [selectedFromAsset, setSourceAsset]);

  useEffect(() => {
    setDestAsset(selectedToAsset);
  }, [selectedToAsset, setDestAsset]);

  const handleFromChainChange = (blockchain: string) => {
    setSelectedFromChain(blockchain);
    navigate({
      search: (prev) => ({ ...prev, source: undefined }),
    });
  };

  const handleToChainChange = (blockchain: string) => {
    setSelectedToChain(blockchain);
    navigate({
      search: (prev) => ({ ...prev, destination: undefined }),
    });
  };

  const handleFromAssetChange = (assetId: string) => {
    const uiAsset = fromAssets.find((a) => a.asset.assetId === assetId);
    if (uiAsset) {
      navigate({
        search: (prev) => ({ ...prev, source: assetId }),
      });
      if (selectedToAsset) {
        logEvent({
          type: "route_selected",
          source: uiAsset.asset,
          destination: selectedToAsset,
        });
      }
    }
  };

  const handleToAssetChange = (assetId: string) => {
    const uiAsset = toAssets.find((a) => a.asset.assetId === assetId);
    if (uiAsset) {
      navigate({
        search: (prev) => ({ ...prev, destination: assetId }),
      });
      if (selectedFromAsset) {
        logEvent({
          type: "route_selected",
          source: selectedFromAsset,
          destination: uiAsset.asset,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-start sm:items-end">
        <div className="flex flex-col items-start sm:items-end gap-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider text-left sm:text-right">
            SWAP FROM
          </div>

          <NetworkSelect
            label=""
            value={selectedFromChain}
            onChange={handleFromChainChange}
            networks={networksForFromChain}
            disabled={networksLoading}
            loading={networksLoading}
          />

          <AssetSelect
            label=""
            value={selectedFromAsset?.assetId}
            onChange={handleFromAssetChange}
            assets={fromAssets.map((ua) => ua.asset)}
            networkBlockchain=""
            direction="source"
            loading={assetsLoading}
            disabled={!selectedFromChain || fromAssets.length === 0}
          />
        </div>

        <div className="flex items-center justify-center py-4 sm:py-8">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="text-gray-400 rotate-90 sm:rotate-0"
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
          <div className="text-xs text-gray-400 uppercase tracking-wider text-left">
            SWAP TO
          </div>

          <NetworkSelect
            label=""
            value={selectedToChain}
            onChange={handleToChainChange}
            networks={networksForToChain}
            disabled={networksLoading}
            loading={networksLoading}
          />

          <AssetSelect
            label=""
            value={selectedToAsset?.assetId}
            onChange={handleToAssetChange}
            assets={toAssets.map((ua) => ua.asset)}
            networkBlockchain=""
            direction="destination"
            loading={assetsLoading}
            disabled={!selectedToChain || toAssets.length === 0}
          />
        </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-gray-300 mb-2.5">
              Amount (USD)
            </label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Enter USD amount"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full bg-[#252525] border-[#343434] text-white placeholder:text-gray-500 text-base md:text-lg font-semibold h-14 md:h-16 px-4 md:px-6 rounded-lg"
            />
                {/* {amount > 0 && sourceAsset?.priceUsd && (
              <div className="mt-2 text-sm text-gray-400">
                ≈ {(amount / sourceAsset.priceUsd).toFixed(6)} {sourceAsset.symbol}
              </div>
            )} */}
          </div>

          <Button
            onClick={handleCompare}
            disabled={
              !selectedFromAsset ||
              !selectedToAsset ||
              compareEnabled ||
              amount <= 0
            }
            className="cursor-pointer w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 bg-[#252525] border border-[#343434] hover:bg-[#2b2b2b] disabled:bg-[#1a1a1a] disabled:border-[#2a2a2a] disabled:cursor-not-allowed text-white font-semibold rounded-lg text-base md:text-lg transition-all duration-200 h-14 md:h-16 flex items-center justify-center whitespace-nowrap"
          >
            {compareEnabled ? "Comparing..." : "Compare"}
          </Button>
        </div>
      </div>
    </div>
  );
};
