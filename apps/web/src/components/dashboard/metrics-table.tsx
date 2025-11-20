import { Fragment, useMemo } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/utils/orpc";

const TREND_ICON_SIZE = "w-5 h-5";
const TREND_COLORS = {
  down: "text-[#ffcccc]",
  up: "text-[#aeffed]",
};

interface MetricsTableProps {
  selectedProvider: string;
  providersInfo: any[];
  loading: boolean;
}

export const MetricsTable = ({
  selectedProvider,
  providersInfo,
  loading: providersLoading,
}: MetricsTableProps) => {
  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ["assets", "near_intents", selectedProvider],
    queryFn: () =>
      client.getListedAssets({
        providers: ["near_intents" as any, selectedProvider as any],
      }),
    enabled: !!selectedProvider,
    refetchOnWindowFocus: false,
  });

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ["volumes-metrics", "near_intents", selectedProvider],
    queryFn: () =>
      client.getVolumesAggregated({
        period: "all",
        providers: ["near_intents" as any, selectedProvider as any],
      }),
    enabled: !!selectedProvider,
    refetchOnWindowFocus: false,
  });

  const nearIntentsAssets = useMemo(
    () => assetsData?.data?.near_intents || [],
    [assetsData]
  );

  const selectedProviderAssets = useMemo(
    () => assetsData?.data?.[selectedProvider as any] || [],
    [assetsData, selectedProvider]
  );

  const nearIntentsChains = useMemo(() => {
    const chains = new Set(nearIntentsAssets.map((a: any) => a.blockchain));
    return chains.size;
  }, [nearIntentsAssets]);

  const selectedProviderChains = useMemo(() => {
    const chains = new Set(selectedProviderAssets.map((a: any) => a.blockchain));
    return chains.size;
  }, [selectedProviderAssets]);

  const isWrapped = (symbol: string) => {
    return (
      symbol.startsWith("W") ||
      symbol.includes(".e") ||
      symbol.toLowerCase().includes("wrapped")
    );
  };

  const nearIntentsRatio = useMemo(() => {
    if (nearIntentsAssets.length === 0) return "0:0";
    const wrapped = nearIntentsAssets.filter((a: any) => isWrapped(a.symbol)).length;
    const native = nearIntentsAssets.length - wrapped;
    return `${native}:${wrapped}`;
  }, [nearIntentsAssets]);

  const selectedProviderRatio = useMemo(() => {
    if (selectedProviderAssets.length === 0) return "0:0";
    const wrapped = selectedProviderAssets.filter((a: any) => isWrapped(a.symbol)).length;
    const native = selectedProviderAssets.length - wrapped;
    return `${native}:${wrapped}`;
  }, [selectedProviderAssets]);

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

  const formatVolume = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const dataRows = useMemo(() => {
    return [
      {
        label: "Assets",
        nearValue: nearIntentsAssets.length.toString(),
        nearColor:
          nearIntentsAssets.length > selectedProviderAssets.length
            ? "text-[#aeffed]"
            : nearIntentsAssets.length < selectedProviderAssets.length
            ? "text-[#ffcccc]"
            : "text-white",
        nearTrend:
          nearIntentsAssets.length > selectedProviderAssets.length
            ? "up"
            : nearIntentsAssets.length < selectedProviderAssets.length
            ? "down"
            : null,
        competitorValue: selectedProviderAssets.length.toString(),
        competitorColor:
          selectedProviderAssets.length > nearIntentsAssets.length
            ? "text-[#aeffed]"
            : selectedProviderAssets.length < nearIntentsAssets.length
            ? "text-[#ffcccc]"
            : "text-white",
        competitorTrend:
          selectedProviderAssets.length > nearIntentsAssets.length
            ? "up"
            : selectedProviderAssets.length < nearIntentsAssets.length
            ? "down"
            : null,
      },
      {
        label: "Chains",
        nearValue: nearIntentsChains.toString(),
        nearColor:
          nearIntentsChains > selectedProviderChains
            ? "text-[#aeffed]"
            : nearIntentsChains < selectedProviderChains
            ? "text-[#ffcccc]"
            : "text-white",
        nearTrend:
          nearIntentsChains > selectedProviderChains
            ? "up"
            : nearIntentsChains < selectedProviderChains
            ? "down"
            : null,
        competitorValue: selectedProviderChains.toString(),
        competitorColor:
          selectedProviderChains > nearIntentsChains
            ? "text-[#aeffed]"
            : selectedProviderChains < nearIntentsChains
            ? "text-[#ffcccc]"
            : "text-white",
        competitorTrend:
          selectedProviderChains > nearIntentsChains
            ? "up"
            : selectedProviderChains < nearIntentsChains
            ? "down"
            : null,
      },
      {
        label: "Native / Wrapped Assets Ratio",
        nearValue: nearIntentsRatio,
        nearColor: "text-white",
        nearTrend: null,
        competitorValue: selectedProviderRatio,
        competitorColor: "text-white",
        competitorTrend: null,
      },
      {
        label: "1D Volume",
        nearValue: formatVolume(nearIntentsVolume.latest),
        nearColor:
          nearIntentsVolume.latest > selectedProviderVolume.latest
            ? "text-[#aeffed]"
            : nearIntentsVolume.latest < selectedProviderVolume.latest
            ? "text-[#ffcccc]"
            : "text-white",
        nearTrend:
          nearIntentsVolume.latest > selectedProviderVolume.latest
            ? "up"
            : nearIntentsVolume.latest < selectedProviderVolume.latest
            ? "down"
            : null,
        competitorValue: formatVolume(selectedProviderVolume.latest),
        competitorColor:
          selectedProviderVolume.latest > nearIntentsVolume.latest
            ? "text-[#aeffed]"
            : selectedProviderVolume.latest < nearIntentsVolume.latest
            ? "text-[#ffcccc]"
            : "text-white",
        competitorTrend:
          selectedProviderVolume.latest > nearIntentsVolume.latest
            ? "up"
            : selectedProviderVolume.latest < nearIntentsVolume.latest
            ? "down"
            : null,
      },
      {
        label: "All-Time Volume",
        nearValue: formatVolume(nearIntentsVolume.total),
        nearColor:
          nearIntentsVolume.total > selectedProviderVolume.total
            ? "text-[#aeffed]"
            : nearIntentsVolume.total < selectedProviderVolume.total
            ? "text-[#ffcccc]"
            : "text-white",
        nearTrend:
          nearIntentsVolume.total > selectedProviderVolume.total
            ? "up"
            : nearIntentsVolume.total < selectedProviderVolume.total
            ? "down"
            : null,
        competitorValue: formatVolume(selectedProviderVolume.total),
        competitorColor:
          selectedProviderVolume.total > nearIntentsVolume.total
            ? "text-[#aeffed]"
            : selectedProviderVolume.total < nearIntentsVolume.total
            ? "text-[#ffcccc]"
            : "text-white",
        competitorTrend:
          selectedProviderVolume.total > nearIntentsVolume.total
            ? "up"
            : selectedProviderVolume.total < nearIntentsVolume.total
            ? "down"
            : null,
      },
    ];
  }, [
    nearIntentsAssets.length,
    selectedProviderAssets.length,
    nearIntentsChains,
    selectedProviderChains,
    nearIntentsRatio,
    selectedProviderRatio,
    nearIntentsVolume,
    selectedProviderVolume,
  ]);

  const loading = providersLoading || assetsLoading || volumeLoading;
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
