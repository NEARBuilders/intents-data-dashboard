import { useRouteQuotes, useVolumes } from "@/hooks/use-route-metrics";
import {
  destAssetAtom,
  selectedProviderAtom,
  sourceAssetAtom,
} from "@/store/swap";
import {
  formatCurrency
} from "@/utils/comparison";
import { useAtom } from "@effect-atom/atom-react";
import { useMemo } from "react";
import {
  VersusComparisonTable,
  type MetricRow,
} from "./versus-comparison-table";

const handleShare = () => {
  const url = window.location.href;
  if (navigator.share) {
    navigator
      .share({
        title: "Swap Comparison",
        url: url,
      })
      .catch(() => {
        navigator.clipboard.writeText(url);
      });
  } else {
    navigator.clipboard.writeText(url);
  }
};

export const MetricsTable = () => {
  const [sourceAsset] = useAtom(sourceAssetAtom);
  const [destAsset] = useAtom(destAssetAtom);
  const [selectedProvider] = useAtom(selectedProviderAtom);

  const { quotes, loading: quotesLoading } = useRouteQuotes();
  const { data: volumeData } = useVolumes("all");

  const selectedRoute = useMemo(() => {
    if (!sourceAsset || !destAsset) return null;
    return { source: sourceAsset, destination: destAsset };
  }, [sourceAsset, destAsset]);

  const nearIntentsQuote = useMemo(() => {
    return quotes.find((q) => q.provider === "near_intents");
  }, [quotes]);

  const selectedProviderQuote = useMemo(() => {
    return quotes.find((q) => q.provider === selectedProvider);
  }, [quotes, selectedProvider]);

  const nearIntentsRate = nearIntentsQuote?.rate;
  const selectedProviderRate = selectedProviderQuote?.rate;

  const nearIntentsLiquidity = nearIntentsQuote?.liquidity;
  const selectedProviderLiquidity = selectedProviderQuote?.liquidity;

  const nearIntentsFee = useMemo(() => {
    return nearIntentsRate?.totalFeesUsd ?? null;
  }, [nearIntentsRate]);

  const providerFee = useMemo(() => {
    return selectedProviderRate?.totalFeesUsd ?? null;
  }, [selectedProviderRate]);

  const nearIntentsVolume = useMemo(() => {
    const data = volumeData?.data?.near_intents;
    if (!data) return { total: 0, latest: 0, thirtyDay: 0 };
    return {
      total: data.totalVolume || 0,
      latest: data.dataPoints?.[data.dataPoints.length - 1]?.volumeUsd || 0,
      thirtyDay:
        data.dataPoints
          ?.slice(-30)
          .reduce((sum, dp) => sum + (dp.volumeUsd || 0), 0) || 0,
    };
  }, [volumeData]);

  const selectedProviderVolume = useMemo(() => {
    const data = volumeData?.data?.[selectedProvider as any];
    if (!data) return { total: 0, latest: 0, thirtyDay: 0 };
    return {
      total: data.totalVolume || 0,
      latest: data.dataPoints?.[data.dataPoints.length - 1]?.volumeUsd || 0,
      thirtyDay:
        data.dataPoints
          ?.slice(-30)
          .reduce((sum, dp) => sum + (dp.volumeUsd || 0), 0) || 0,
    };
  }, [volumeData, selectedProvider]);

  const getIndicator = (
    leftVal: number | null | undefined,
    rightVal: number | null | undefined,
    lowerIsBetter: boolean
  ): "up" | "down" | undefined => {
    if (
      leftVal === null ||
      leftVal === undefined ||
      rightVal === null ||
      rightVal === undefined
    )
      return undefined;
    if (leftVal === rightVal) return undefined;

    const leftIsBetter = lowerIsBetter
      ? leftVal < rightVal
      : leftVal > rightVal;
    return leftIsBetter ? "up" : "down";
  };

  const swapMetrics: MetricRow[] = useMemo(() => {
    const nearReceive = nearIntentsRate?.amountOutUsd ?? null;
    const competitorReceive = selectedProviderRate?.amountOutUsd ?? null;

    const nearCost = nearIntentsFee ?? null;
    const competitorCost = providerFee ?? null;

    const nearLiq05 =
      nearIntentsLiquidity?.thresholds?.[0]?.maxAmountInUsd ?? null;
    const competitorLiq05 =
      selectedProviderLiquidity?.thresholds?.[0]?.maxAmountInUsd ?? null;

    const nearLiq10 =
      nearIntentsLiquidity?.thresholds?.[1]?.maxAmountInUsd ?? null;
    const competitorLiq10 =
      selectedProviderLiquidity?.thresholds?.[1]?.maxAmountInUsd ?? null;

    const isNearUnsupported = !nearIntentsQuote;
    const isProviderUnsupported = !selectedProviderQuote;

    return [
      {
        label: "Receive (USD)",
        tooltip: "Amount you will receive from this swap in USD",
        leftValue: nearReceive !== null ? formatCurrency(nearReceive) : null,
        rightValue: competitorReceive !== null ? formatCurrency(competitorReceive) : null,
        leftIndicator: getIndicator(nearReceive, competitorReceive, false),
        rightIndicator: getIndicator(competitorReceive, nearReceive, false),
        leftLoading: quotesLoading,
        rightLoading: quotesLoading,
        leftUnsupported: isNearUnsupported,
        rightUnsupported: isProviderUnsupported,
      },
      {
        label: "Estimated Cost",
        tooltip: "Total fees estimated for this swap in USD",
        leftValue: nearCost !== null ? formatCurrency(nearCost) : null,
        rightValue: competitorCost !== null ? formatCurrency(competitorCost) : null,
        leftIndicator: getIndicator(nearCost, competitorCost, true),
        rightIndicator: getIndicator(competitorCost, nearCost, true),
        leftLoading: quotesLoading,
        rightLoading: quotesLoading,
        leftUnsupported: isNearUnsupported,
        rightUnsupported: isProviderUnsupported,
      },
      {
        label: "Liquidity (≤0.5% Slippage)",
        tooltip: "Maximum swap size in USD before exceeding 0.5% slippage",
        leftValue: nearLiq05 !== null ? formatCurrency(nearLiq05) : null,
        rightValue: competitorLiq05 !== null ? formatCurrency(competitorLiq05) : null,
        leftIndicator: getIndicator(nearLiq05, competitorLiq05, false),
        rightIndicator: getIndicator(competitorLiq05, nearLiq05, false),
        leftLoading: quotesLoading,
        rightLoading: quotesLoading,
        leftUnsupported:
          isNearUnsupported || !nearIntentsLiquidity?.thresholds?.[0],
        rightUnsupported:
          isProviderUnsupported || !selectedProviderLiquidity?.thresholds?.[0],
      },
      {
        label: "Liquidity (≤1.0% Slippage)",
        tooltip: "Maximum swap size in USD before exceeding 1.0% slippage",
        leftValue: nearLiq10 !== null ? formatCurrency(nearLiq10) : null,
        rightValue: competitorLiq10 !== null ? formatCurrency(competitorLiq10) : null,
        leftIndicator: getIndicator(nearLiq10, competitorLiq10, false),
        rightIndicator: getIndicator(competitorLiq10, nearLiq10, false),
        leftLoading: quotesLoading,
        rightLoading: quotesLoading,
        leftUnsupported:
          isNearUnsupported || !nearIntentsLiquidity?.thresholds?.[1],
        rightUnsupported:
          isProviderUnsupported || !selectedProviderLiquidity?.thresholds?.[1],
      },
    ];
  }, [
    nearIntentsFee,
    providerFee,
    nearIntentsLiquidity,
    selectedProviderLiquidity,
    nearIntentsQuote,
    selectedProviderQuote,
    quotesLoading,
  ]);

  if (quotesLoading && !selectedRoute) {
    return null;
  }

  return (
    <section className="relative w-full">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <div className="max-w-[900px] mx-auto">
          <VersusComparisonTable
            metrics={swapMetrics}
            showProviderSelector={false}
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 text-white hover:text-gray-300 transition-colors text-sm cursor-pointer"
            >
              Share →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
