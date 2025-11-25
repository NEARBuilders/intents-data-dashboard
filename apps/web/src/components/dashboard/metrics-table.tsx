import { useMemo } from "react";
import type { Route, ProviderInfo } from "@/types/common";
import { useRates, useLiquidity, useVolumes } from "@/hooks/use-route-metrics";
import { formatVolume, formatCurrency, formatPercentage } from "@/utils/comparison";
import { VersusComparisonTable, type MetricRow } from "./versus-comparison-table";

interface MetricsTableProps {
  selectedProvider: string;
  providersInfo: ProviderInfo[];
  selectedRoute: Route | null;
}

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

export const MetricsTable = ({
  selectedProvider,
  providersInfo,
  selectedRoute,
}: MetricsTableProps) => {
  const { data: ratesData, isLoading: ratesLoading } = useRates(
    selectedRoute,
    ["near_intents", selectedProvider],
    !!selectedProvider
  );

  const { data: liquidityData, isLoading: liquidityLoading } = useLiquidity(
    selectedRoute,
    ["near_intents", selectedProvider],
    !!selectedProvider
  );

  const { data: volumeData, isLoading: volumeLoading } = useVolumes(
    selectedRoute,
    ["near_intents", selectedProvider],
    "all",
    !!selectedProvider
  );

  const nearIntentsRate = ratesData?.data?.near_intents?.[0];
  const selectedProviderRate = ratesData?.data?.[selectedProvider]?.[0];

  const nearIntentsLiquidity = liquidityData?.data?.near_intents?.[0];
  const selectedProviderLiquidity = liquidityData?.data?.[selectedProvider]?.[0];

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
      thirtyDay: data.dataPoints?.slice(-30).reduce((sum, dp) => sum + (dp.volumeUsd || 0), 0) || 0,
    };
  }, [volumeData]);

  const selectedProviderVolume = useMemo(() => {
    const data = volumeData?.data?.[selectedProvider as any];
    if (!data) return { total: 0, latest: 0, thirtyDay: 0 };
    return {
      total: data.totalVolume || 0,
      latest: data.dataPoints?.[data.dataPoints.length - 1]?.volumeUsd || 0,
      thirtyDay: data.dataPoints?.slice(-30).reduce((sum, dp) => sum + (dp.volumeUsd || 0), 0) || 0,
    };
  }, [volumeData, selectedProvider]);

  const selectedProviderInfo = useMemo(() => {
    return providersInfo.find((p) => p.id === selectedProvider);
  }, [providersInfo, selectedProvider]);

  const nearIntentsInfo = useMemo(() => {
    return providersInfo.find((p) => p.id === "near_intents");
  }, [providersInfo]);

  const getIndicator = (leftVal: number | null | undefined, rightVal: number | null | undefined, lowerIsBetter: boolean): "up" | "down" | undefined => {
    if (leftVal === null || leftVal === undefined || rightVal === null || rightVal === undefined) return undefined;
    if (leftVal === rightVal) return undefined;
    
    const leftIsBetter = lowerIsBetter ? leftVal < rightVal : leftVal > rightVal;
    return leftIsBetter ? "up" : "down";
  };

  const swapMetrics: MetricRow[] = useMemo(() => {
    const nearCost = nearIntentsFee ?? undefined;
    const competitorCost = providerFee ?? undefined;
    const nearLiq = nearIntentsLiquidity?.thresholds?.[0]?.slippageBps ?? null;
    const competitorLiq = selectedProviderLiquidity?.thresholds?.[0]?.slippageBps ?? null;

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
        leftIndicator: getIndicator(nearIntentsVolume.total, selectedProviderVolume.total, false),
        rightIndicator: getIndicator(selectedProviderVolume.total, nearIntentsVolume.total, false),
      },
      {
        label: "30D Volume",
        leftValue: formatVolume(nearIntentsVolume.thirtyDay),
        rightValue: formatVolume(selectedProviderVolume.thirtyDay),
        leftIndicator: getIndicator(nearIntentsVolume.thirtyDay, selectedProviderVolume.thirtyDay, false),
        rightIndicator: getIndicator(selectedProviderVolume.thirtyDay, nearIntentsVolume.thirtyDay, false),
      },
      {
        label: "1D Volume",
        leftValue: formatVolume(nearIntentsVolume.latest),
        rightValue: formatVolume(selectedProviderVolume.latest),
        leftIndicator: getIndicator(nearIntentsVolume.latest, selectedProviderVolume.latest, false),
        rightIndicator: getIndicator(selectedProviderVolume.latest, nearIntentsVolume.latest, false),
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

  const loading = ratesLoading || liquidityLoading || volumeLoading;

  if (loading && !selectedRoute) {
    return null;
  }

  return (
    <section className="relative w-full bg-[#090909] py-10 md:py-12 lg:py-16">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <div className="max-w-[900px] mx-auto">
          <VersusComparisonTable
            leftProvider={{
              name: nearIntentsInfo?.label || "NEAR Intents",
              icon: "/images/provider-icons/near_intents.png",
            }}
            rightProvider={{
              name: selectedProviderInfo?.label || "Provider",
              icon: undefined,
            }}
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
