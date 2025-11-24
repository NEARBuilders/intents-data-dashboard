import { useMemo } from "react";
import type { Route, ProviderInfo } from "@/types/common";
import { useRates, useLiquidity, useVolumes } from "@/hooks/use-route-metrics";
import { formatVolume, formatCurrency, formatPercentage } from "@/utils/comparison";
import { useStaticAssets } from "@/hooks/use-static-assets";
import { calculateEstimatedFee } from "@/utils/fees";
import { VersusComparisonTable, type MetricRow } from "./versus-comparison-table";

interface MetricsTableProps {
  selectedProvider: string;
  providersInfo: ProviderInfo[];
  selectedRoute: Route | null;
}

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

  const { data: staticAssets } = useStaticAssets();

  const nearIntentsRate = ratesData?.data?.near_intents?.[0];
  const selectedProviderRate = ratesData?.data?.[selectedProvider]?.[0];

  const nearIntentsLiquidity = liquidityData?.data?.near_intents?.[0];
  const selectedProviderLiquidity = liquidityData?.data?.[selectedProvider]?.[0];

  const nearIntentsFee = useMemo(() => {
    if (!nearIntentsRate) return null;
    return calculateEstimatedFee(nearIntentsRate, staticAssets?.assets);
  }, [nearIntentsRate, staticAssets]);

  const providerFee = useMemo(() => {
    if (!selectedProviderRate) return null;
    return calculateEstimatedFee(selectedProviderRate, staticAssets?.assets);
  }, [selectedProviderRate, staticAssets]);

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
    const nearCost = nearIntentsFee ?? null;
    const competitorCost = providerFee ?? null;
    const nearLiq = nearIntentsLiquidity?.thresholds?.[0]?.slippageBps ?? null;
    const competitorLiq = selectedProviderLiquidity?.thresholds?.[0]?.slippageBps ?? null;

    return [
      {
        label: "Estimated Cost",
        leftValue: formatCurrency(nearCost ?? undefined),
        rightValue: formatCurrency(competitorCost ?? undefined),
        leftIndicator: getIndicator(nearCost ?? undefined, competitorCost ?? undefined, true),
        rightIndicator: getIndicator(competitorCost ?? undefined, nearCost ?? undefined, true),
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
        leftValue: formatPercentage(nearLiq),
        rightValue: formatPercentage(competitorLiq),
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
        <VersusComparisonTable
          leftProvider={{
            name: nearIntentsInfo?.label || "NEAR Intents",
            icon: "/images/photopea-online-editor-image-1.png",
          }}
          rightProvider={{
            name: selectedProviderInfo?.label || "Provider",
            icon: undefined,
          }}
          metrics={swapMetrics}
          showProviderSelector={false}
        />
      </div>
    </section>
  );
};
