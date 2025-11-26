import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProviders } from "@/lib/aggregator/hooks";
import { compareEnabledAtom, selectedProviderAtom } from "@/store/swap";
import { useAtom } from "@effect-atom/atom-react";
import { useMemo } from "react";

export interface MetricRow {
  label: string;
  tooltip?: string;
  leftValue: string | number | null | undefined;
  rightValue: string | number | null | undefined;
  leftIndicator?: "up" | "down";
  rightIndicator?: "up" | "down";
  leftLoading?: boolean;
  rightLoading?: boolean;
  leftUnsupported?: boolean;
  rightUnsupported?: boolean;
}

interface VersusComparisonTableProps {
  metrics: MetricRow[];
  className?: string;
  showProviderSelector?: boolean;
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function IndicatorIcon({ type }: { type?: "up" | "down" }) {
  if (!type) return null;
  if (type === "up") {
    return <span className="text-green-400 ml-1">↑</span>;
  }
  return <span className="text-red-400 ml-1">↓</span>;
}

export const VersusComparisonTable = ({
  metrics,
  className = "",
  showProviderSelector = false,
}: VersusComparisonTableProps) => {
  const [selectedProvider, setSelectedProvider] = useAtom(selectedProviderAtom);
  const [, setCompareEnabled] = useAtom(compareEnabledAtom);
  const { data: providersData } = useProviders();

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setCompareEnabled(false);
  };

  const providersInfo = providersData?.providers || [];

  const nearIntentsInfo = useMemo(() => {
    return providersInfo.find((p: any) => p.id === "near_intents");
  }, [providersInfo]);

  const providerOptions = useMemo(
    () =>
      providersInfo
        .filter(
          (p) => p.id !== "near_intents" && p.supportedData?.includes("assets")
        )
        .map((p) => ({ value: p.id, label: p.label, logoUrl: p.logoUrl })),
    [providersInfo]
  );

  const selectedProviderInfo = useMemo(() => {
    return providersInfo.find((p: any) => p.id === selectedProvider);
  }, [providersInfo, selectedProvider]);
  return (
    <Card
      className={`bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden max-w-[900px] mx-auto ${className}`}
    >
      <CardContent className="p-0">
        <div className="border-b border-[#343434]">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-2 md:gap-3 justify-center">
              {nearIntentsInfo?.logoUrl && (
                <img
                  src={nearIntentsInfo.logoUrl}
                  alt={nearIntentsInfo.label}
                  className="h-8 md:h-10 lg:h-12 object-cover"
                />
              )}
            </div>

            <div className="flex items-center justify-center px-2 md:px-4 w-[80px] md:w-[180px]">
              <span className="font-bold text-white text-2xl md:text-3xl lg:text-5xl tracking-[-1.44px]">
                vs
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-3 justify-center">
              {showProviderSelector || !selectedProviderInfo ? (
                <Select
                  value={selectedProvider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="w-[120px] md:w-[180px] lg:w-[220px] h-[38px] md:h-[42px] bg-[#242424] border-[#343434] rounded-[5px] text-sm md:text-lg tracking-[-0.54px] text-white hover:bg-[#2a2a2a] focus:ring-1 focus:ring-[#343434]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-[#343434]">
                    {providerOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                            {option.logoUrl ? (
                              <img
                                src={option.logoUrl}
                                alt={option.label}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full bg-[#202027]" />
                            )}
                          </div>
                          <span className="text-md">{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  {selectedProviderInfo?.logoUrl && (
                    <img
                      src={selectedProviderInfo.logoUrl}
                      alt={selectedProviderInfo.label}
                      className="h-6 md:h-8 lg:h-10 object-cover"
                    />
                  )}
                  <span className="font-bold text-white text-sm md:text-lg lg:text-xl tracking-[-0.54px] truncate">
                    {selectedProviderInfo?.label}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#343434]">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_auto_1fr] gap-1 md:gap-4 px-3 md:px-6 py-2 md:py-3"
            >
              <div className="flex items-center justify-center">
                {metric.leftLoading ? (
                  <span className="text-gray-400 animate-spin">⟳</span>
                ) : metric.leftUnsupported || metric.leftValue === null || metric.leftValue === undefined ? (
                  <span className="text-red-500 text-base md:text-xl">❌</span>
                ) : (
                  <>
                    <span className="font-medium text-white text-sm md:text-lg lg:text-xl truncate">
                      {formatValue(metric.leftValue)}
                    </span>
                    <IndicatorIcon type={metric.leftIndicator} />
                  </>
                )}
              </div>

              <div className="flex items-center justify-center px-1 md:px-4 w-[80px] md:w-[180px] flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs md:text-sm text-center truncate">
                    {metric.label}
                  </span>
                  {metric.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-500 text-gray-500 cursor-help hover:border-gray-400 hover:text-gray-400 transition-colors">
                            <span className="text-[10px] font-semibold">i</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{metric.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center">
                {metric.rightLoading ? (
                  <span className="text-gray-400 animate-spin text-sm md:text-base">⟳</span>
                ) : metric.rightUnsupported || metric.rightValue === null || metric.rightValue === undefined ? (
                  <span className="text-red-500 text-base md:text-xl">❌</span>
                ) : (
                  <>
                    <span className="font-medium text-white text-sm md:text-lg lg:text-xl truncate">
                      {formatValue(metric.rightValue)}
                    </span>
                    <IndicatorIcon type={metric.rightIndicator} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
