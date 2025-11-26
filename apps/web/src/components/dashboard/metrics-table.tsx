import { useRouteQuotes, useVolumes } from "@/hooks/use-route-metrics";
import {
  destAssetAtom,
  selectedProviderAtom,
  sourceAssetAtom
} from "@/store/swap";
import {
  formatCurrency,
  formatPercentage,
  formatVolume,
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
    const nearCost = nearIntentsFee ?? undefined;
    const competitorCost = providerFee ?? undefined;
    const nearLiq = nearIntentsLiquidity?.thresholds?.[0]?.slippageBps ?? null;
    const competitorLiq =
      selectedProviderLiquidity?.thresholds?.[0]?.slippageBps ?? null;

    return [
      {
        label: "Estimated Cost",
        leftValue: formatCurrency(nearCost),
        rightValue: formatCurrency(competitorCost),
        leftIndicator: getIndicator(nearCost, competitorCost, true),
        rightIndicator: getIndicator(competitorCost, nearCost, true),
      },
      {
        label: "Fees Generated",
        leftValue: null,
        rightValue: null,
        leftIndicator: "up",
        rightIndicator: "down",
      },
      {
        label: "Liquidity Depth",
        leftValue: formatPercentage(nearLiq ?? undefined),
        rightValue: formatPercentage(competitorLiq ?? undefined),
        leftIndicator: getIndicator(nearLiq, competitorLiq, true),
        rightIndicator: getIndicator(competitorLiq, nearLiq, true),
      },
      {
        label: "Total Volume",
        leftValue: formatVolume(nearIntentsVolume.total),
        rightValue: formatVolume(selectedProviderVolume.total),
        leftIndicator: getIndicator(
          nearIntentsVolume.total,
          selectedProviderVolume.total,
          false
        ),
        rightIndicator: getIndicator(
          selectedProviderVolume.total,
          nearIntentsVolume.total,
          false
        ),
      },
      {
        label: "30D Volume",
        leftValue: formatVolume(nearIntentsVolume.thirtyDay),
        rightValue: formatVolume(selectedProviderVolume.thirtyDay),
        leftIndicator: getIndicator(
          nearIntentsVolume.thirtyDay,
          selectedProviderVolume.thirtyDay,
          false
        ),
        rightIndicator: getIndicator(
          selectedProviderVolume.thirtyDay,
          nearIntentsVolume.thirtyDay,
          false
        ),
      },
      {
        label: "1D Volume",
        leftValue: formatVolume(nearIntentsVolume.latest),
        rightValue: formatVolume(selectedProviderVolume.latest),
        leftIndicator: getIndicator(
          nearIntentsVolume.latest,
          selectedProviderVolume.latest,
          false
        ),
        rightIndicator: getIndicator(
          selectedProviderVolume.latest,
          nearIntentsVolume.latest,
          false
        ),
      },
    ];
  }, [
    nearIntentsFee,
    providerFee,
    nearIntentsLiquidity,
    selectedProviderLiquidity,
    nearIntentsVolume,
    selectedProviderVolume,
  ]);

  if (quotesLoading && !selectedRoute) {
    return null;
  }

  return (
    <section className="relative w-full bg-[#090909] py-10 md:py-12 lg:py-16">
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
