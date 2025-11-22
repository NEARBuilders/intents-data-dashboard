import { Fragment, useMemo } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Route, ProviderInfo } from "@/types/common";
import { useRates, useLiquidity, useVolumes } from "@/hooks/use-route-metrics";
import {
  calculateTrend,
  getComparisonColor,
  formatVolume,
  formatCurrency,
  formatPercentage,
} from "@/utils/comparison";

const TREND_ICON_SIZE = "w-5 h-5";
const TREND_COLORS = {
  down: "text-[#ffcccc]",
  up: "text-[#aeffed]",
};

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

  const nearIntentsVolume = useMemo(() => {
    const data = volumeData?.data?.near_intents;
    if (!data) return { total: 0, latest: 0 };
    return {
      total: data.totalVolume || 0,
      latest: data.dataPoints?.[data.dataPoints.length - 1]?.volumeUsd || 0,
    };
  }, [volumeData]);

  const selectedProviderVolume = useMemo(() => {
    const data = volumeData?.data?.[selectedProvider as any];
    if (!data) return { total: 0, latest: 0 };
    return {
      total: data.totalVolume || 0,
      latest: data.dataPoints?.[data.dataPoints.length - 1]?.volumeUsd || 0,
    };
  }, [volumeData, selectedProvider]);

  const nearIntentsRate = ratesData?.data?.near_intents?.[0];
  const selectedProviderRate = ratesData?.data?.[selectedProvider]?.[0];
  
  const nearIntentsLiquidity = liquidityData?.data?.near_intents?.[0];
  const selectedProviderLiquidity = liquidityData?.data?.[selectedProvider]?.[0];

  const dataRows = useMemo(() => {
    if (!selectedRoute) return [];
    
    const nearCost = nearIntentsRate?.totalFeesUsd;
    const competitorCost = selectedProviderRate?.totalFeesUsd;
    const nearLiq = nearIntentsLiquidity?.thresholds?.[0]?.slippageBps;
    const competitorLiq = selectedProviderLiquidity?.thresholds?.[0]?.slippageBps;
    
    return [
      {
        label: "Estimated Cost",
        nearValue: formatCurrency(nearCost),
        nearColor: getComparisonColor(nearCost, competitorCost, true),
        nearTrend: calculateTrend(nearCost, competitorCost, true),
        competitorValue: formatCurrency(competitorCost),
        competitorColor: getComparisonColor(competitorCost, nearCost, true),
        competitorTrend: calculateTrend(competitorCost, nearCost, true),
      },
      {
        label: "Liquidity Depth",
        nearValue: formatPercentage(nearLiq),
        nearColor: getComparisonColor(nearLiq, competitorLiq, true),
        nearTrend: calculateTrend(nearLiq, competitorLiq, true),
        competitorValue: formatPercentage(competitorLiq),
        competitorColor: getComparisonColor(competitorLiq, nearLiq, true),
        competitorTrend: calculateTrend(competitorLiq, nearLiq, true),
      },
      {
        label: "1D Volume",
        nearValue: formatVolume(nearIntentsVolume.latest),
        nearColor: getComparisonColor(nearIntentsVolume.latest, selectedProviderVolume.latest, false),
        nearTrend: calculateTrend(nearIntentsVolume.latest, selectedProviderVolume.latest, false),
        competitorValue: formatVolume(selectedProviderVolume.latest),
        competitorColor: getComparisonColor(selectedProviderVolume.latest, nearIntentsVolume.latest, false),
        competitorTrend: calculateTrend(selectedProviderVolume.latest, nearIntentsVolume.latest, false),
      },
      {
        label: "All-Time Volume",
        nearValue: formatVolume(nearIntentsVolume.total),
        nearColor: getComparisonColor(nearIntentsVolume.total, selectedProviderVolume.total, false),
        nearTrend: calculateTrend(nearIntentsVolume.total, selectedProviderVolume.total, false),
        competitorValue: formatVolume(selectedProviderVolume.total),
        competitorColor: getComparisonColor(selectedProviderVolume.total, nearIntentsVolume.total, false),
        competitorTrend: calculateTrend(selectedProviderVolume.total, nearIntentsVolume.total, false),
      },
    ];
  }, [
    nearIntentsRate,
    selectedProviderRate,
    nearIntentsLiquidity,
    selectedProviderLiquidity,
    nearIntentsVolume,
    selectedProviderVolume,
    selectedRoute,
  ]);

  const loading = ratesLoading || liquidityLoading || volumeLoading;

  const selectedProviderLabel = useMemo(
    () =>
      providersInfo.find((p) => p.id === selectedProvider)?.label ||
      "Provider",
    [providersInfo, selectedProvider]
  );

  if (loading) {
    return (
      <section className="w-full flex justify-center py-4 px-4 md:px-6 lg:px-0">
        <Card className="w-full max-w-[844px] bg-[#0e0e0e] rounded-[14px] border border-[#343434] overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-center h-32">
              <span className="text-white text-sm">Loading metrics...</span>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="w-full flex justify-center py-4 px-4 md:px-6 lg:px-0">
      <Card className="w-full max-w-[844px] bg-[#0e0e0e] rounded-[14px] border border-[#343434] overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-2 h-[57px] items-center relative">
            <div className="flex items-center justify-center h-full px-4">
              <span className="font-medium text-white text-[22px] text-center tracking-[-0.66px] leading-normal">
                NEAR Intents
              </span>
            </div>
            <div className="flex items-center justify-center h-full px-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-[#343434]" />
              <span className="font-medium text-white text-[22px] text-center tracking-[-0.66px] leading-normal">
                {selectedProviderLabel}
              </span>
            </div>
          </div>

          <div className="md:hidden flex flex-col py-3 px-4 border-b border-[#343434]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white text-lg tracking-[-0.54px]">
                NEAR Intents
              </span>
              <span className="font-medium text-white text-lg tracking-[-0.54px]">
                {selectedProviderLabel}
              </span>
            </div>
          </div>

          <Separator className="bg-[#343434]" />

          {dataRows.map((row, index) => (
            <Fragment key={index}>
              <div className="hidden md:grid grid-cols-3 h-[52px] items-center">
                <div className="flex items-center justify-center h-full px-4 gap-2">
                  <span
                    className={`font-medium text-[22px] text-center tracking-[-0.66px] leading-normal ${row.nearColor}`}
                  >
                    {row.nearValue}
                  </span>
                  {row.nearTrend === "down" && (
                    <ArrowDownIcon
                      className={`${TREND_ICON_SIZE} ${TREND_COLORS.down}`}
                    />
                  )}
                  {row.nearTrend === "up" && (
                    <ArrowUpIcon
                      className={`${TREND_ICON_SIZE} ${TREND_COLORS.up}`}
                    />
                  )}
                </div>
                <div className="flex items-center justify-center h-full px-4">
                  <span className="font-medium text-[#8b8b8b] text-base text-center tracking-[-0.48px] leading-normal">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center justify-center h-full px-4 gap-2">
                  <span
                    className={`font-medium text-[22px] text-center tracking-[-0.66px] leading-normal ${row.competitorColor}`}
                  >
                    {row.competitorValue}
                  </span>
                  {row.competitorTrend === "down" && (
                    <ArrowDownIcon
                      className={`${TREND_ICON_SIZE} ${TREND_COLORS.down}`}
                    />
                  )}
                  {row.competitorTrend === "up" && (
                    <ArrowUpIcon
                      className={`${TREND_ICON_SIZE} ${TREND_COLORS.up}`}
                    />
                  )}
                </div>
              </div>

              <div className="md:hidden py-3 px-4 border-b border-[#343434]">
                <div className="mb-2">
                  <span className="font-medium text-[#8b8b8b] text-sm tracking-[-0.42px]">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-lg tracking-[-0.54px] ${row.nearColor}`}
                    >
                      {row.nearValue}
                    </span>
                    {row.nearTrend === "down" && (
                      <ArrowDownIcon
                        className={`w-4 h-4 ${TREND_COLORS.down}`}
                      />
                    )}
                    {row.nearTrend === "up" && (
                      <ArrowUpIcon className={`w-4 h-4 ${TREND_COLORS.up}`} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-lg tracking-[-0.54px] ${row.competitorColor}`}
                    >
                      {row.competitorValue}
                    </span>
                    {row.competitorTrend === "down" && (
                      <ArrowDownIcon
                        className={`w-4 h-4 ${TREND_COLORS.down}`}
                      />
                    )}
                    {row.competitorTrend === "up" && (
                      <ArrowUpIcon className={`w-4 h-4 ${TREND_COLORS.up}`} />
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-[#343434]" />
            </Fragment>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
