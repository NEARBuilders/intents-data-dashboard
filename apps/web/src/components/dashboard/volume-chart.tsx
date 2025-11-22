import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { generateProviderColor } from "@/utils/colors";

interface VolumeChartProps {
  volumeData?: any;
  providersInfo: any[];
  loading: boolean;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  visibleProviders: Set<string>;
  onToggleProvider: (id: string) => void;
}

const formatDate = (dateStr: string, period: string) => {
  const date = new Date(dateStr);

  if (period === "7D" || period === "30D" || period === "90D") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const formatFullDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const periods = ["7D", "30D", "90D", "ALL"];

export const VolumeChart = ({
  volumeData,
  providersInfo,
  loading,
  selectedPeriod,
  onPeriodChange,
  visibleProviders,
  onToggleProvider,
}: VolumeChartProps) => {
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const hoverTimeoutRef = useRef<number | null>(null);

  const providerTotals = useMemo(() => {
    if (!volumeData?.data) return [];

    return providersInfo
      .map((provider) => {
        const providerData = volumeData.data[provider.id];
        const total = providerData?.totalVolume || 0;
        return { ...provider, totalVolume: total };
      })
      .sort((a, b) => {
        if (a.id === "near_intents") return -1;
        if (b.id === "near_intents") return 1;
        return b.totalVolume - a.totalVolume;
      });
  }, [volumeData, providersInfo]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    groups.set("All", []);
    groups.set("Aggregators", ["Bridge Aggregator"]);
    groups.set("Bridges", ["Pool-based Bridge", "Other Bridge"]);
    groups.set("Clearing", ["Clearing Protocol"]);
    groups.set("GMP", ["GMP"]);
    groups.set("Intent-based", ["Intent-based Bridge"]);
    return groups;
  }, []);

  const filteredProviders = useMemo(() => {
    const nearIntents = providerTotals.find((p) => p.id === "near_intents");

    let filtered = providerTotals.filter((p) => p.id !== "near_intents");

    if (selectedCategories.length > 0 && !selectedCategories.includes("All")) {
      const categoriesToFilter: string[] = [];
      selectedCategories.forEach((group) => {
        const cats = categoryGroups.get(group);
        if (cats && cats.length > 0) {
          categoriesToFilter.push(...cats);
        }
      });
      filtered = filtered.filter((p) =>
        categoriesToFilter.includes(p.category)
      );
    }

    return nearIntents ? [nearIntents, ...filtered] : filtered;
  }, [providerTotals, selectedCategories, categoryGroups]);

  const displayedProviders = useMemo(() => {
    const mobileLimit = isMobile ? 4 : 6;
    return showAllProviders ? filteredProviders : filteredProviders.slice(0, mobileLimit);
  }, [filteredProviders, showAllProviders, isMobile]);

  const chartData = useMemo(() => {
    if (!volumeData?.data) return [];

    const allDates = new Set<string>();
    Object.values(volumeData.data).forEach((providerData: any) => {
      providerData.dataPoints?.forEach((dp: any) => allDates.add(dp.date));
    });

    const sortedDates = Array.from(allDates).sort();

    return sortedDates.map((date) => {
      const dataPoint: any = {
        name: formatDate(date, selectedPeriod),
        rawDate: date,
      };

      displayedProviders.forEach((provider) => {
        if (!visibleProviders.has(provider.id)) return;

        const providerData = volumeData.data[provider.id];
        const dateData = providerData?.dataPoints?.find(
          (dp: any) => dp.date === date
        );

        dataPoint[provider.label] =
          dateData?.cumulativeVolume / 1_000_000_000 || 0;
      });

      return dataPoint;
    });
  }, [volumeData, displayedProviders, visibleProviders, selectedPeriod]);

  const protocolColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    displayedProviders.forEach((provider) => {
      if (provider.id === "near_intents") {
        colors[provider.label] = "#3ffa90";
      } else {
        colors[provider.label] = generateProviderColor(provider.id);
      }
    });
    return colors;
  }, [displayedProviders]);

  const legendItems = useMemo(
    () =>
      displayedProviders.map((provider) => ({
        id: provider.id,
        label: provider.label,
        color:
          provider.id === "near_intents"
            ? "#3ffa90"
            : generateProviderColor(provider.id),
        visible: visibleProviders.has(provider.id),
        totalVolume: provider.totalVolume,
        category: provider.category,
        isNearIntents: provider.id === "near_intents",
      })),
    [displayedProviders, visibleProviders]
  );

  const maxVolume = useMemo(() => {
    if (chartData.length === 0) return 5.5;
    let max = 0;
    chartData.forEach((dataPoint) => {
      Object.keys(dataPoint).forEach((key) => {
        if (key !== "name" && typeof dataPoint[key] === "number") {
          max = Math.max(max, dataPoint[key]);
        }
      });
    });
    return Math.ceil(max * 1.1);
  }, [chartData]);

  const nearIntentsTotal = useMemo(() => {
    if (!chartData.length) return "$0B";
    const lastDataPoint = chartData[chartData.length - 1];
    const nearIntentsProvider = providersInfo.find(
      (p) => p.id === "near_intents"
    );
    if (!nearIntentsProvider) return "$0B";
    const value = lastDataPoint[nearIntentsProvider.label] || 0;
    return `$${value.toFixed(1)}B`;
  }, [chartData, providersInfo]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Responsive margin for mobile
  const chartMargin = useMemo(() => {
    if (isMobile) {
      return { top: 5, right: 5, left: 0, bottom: 20 };
    }
    return { top: 5, right: 30, left: 30, bottom: 60 };
  }, [isMobile]);

  // Responsive XAxis config for mobile
  const xAxisInterval = isMobile ? 1 : 0; // Show every other label on mobile
  const xAxisFontSize = isMobile ? 7 : 8;

  // Throttle tooltip updates to prevent excessive re-renders
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 16; // ~60fps

  const handleTooltipChange = useCallback(
    (active: boolean, payload: any, coordinate?: { x: number; y: number }) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) {
        return;
      }
      lastUpdateRef.current = now;

      if (hoverTimeoutRef.current !== null) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }

      if (active && payload && payload.length && coordinate) {
        setHoveredData(payload);

        // Calculate offsets based on screen size
        const leftOffset = isMobile ? 0 : 40; // left-0 on mobile, left-10 (40px) on desktop
        const topOffset = isMobile ? 80 : 154; // top-[80px] on mobile, top-[154px] on desktop
        const chartHeight = isMobile ? 380 : 475; // Chart container height
        const xAxisHeight = 60; // X-axis labels height
        const tooltipHeight = 250; // Approximate tooltip height

        // Position tooltip higher above X-axis labels to avoid covering them
        // Place it at the upper-middle of the chart area, well above X-axis
        const tooltipY =
          topOffset + (chartHeight - xAxisHeight - tooltipHeight / 2 - 80);

        let tooltipX = coordinate.x + leftOffset + 20; // Add 20px for tooltip padding

        // Ensure tooltip stays within viewport bounds (only adjust horizontal position)
        if (typeof window !== "undefined") {
          const tooltipWidth = 200; // Approximate tooltip width
          const viewportWidth = window.innerWidth;

          // Adjust horizontal position if tooltip would go off screen
          if (tooltipX + tooltipWidth > viewportWidth - 16) {
            tooltipX = viewportWidth - tooltipWidth - 16; // 16px padding from edge
          }
          if (tooltipX < 16) {
            tooltipX = 16; // 16px padding from left edge
          }
        }

        setTooltipPosition({
          x: tooltipX,
          y: tooltipY,
        });
      } else {
        // Small delay to prevent flickering
        hoverTimeoutRef.current = window.setTimeout(() => {
          setHoveredData(null);
          setTooltipPosition(null);
          hoverTimeoutRef.current = null;
        }, 100);
      }
    },
    [isMobile]
  );

  const CustomTooltip = useCallback(
    ({ active, payload, coordinate }: any) => {
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          handleTooltipChange(active, payload, coordinate);
        });
      }
      return null;
    },
    [handleTooltipChange]
  );

  const hoveredDate = useMemo(() => {
    if (!hoveredData || hoveredData.length === 0) return null;
    const rawDate = hoveredData[0]?.payload?.rawDate;
    return rawDate ? formatFullDate(rawDate) : null;
  }, [hoveredData]);

  const sortedHoveredData = useMemo(() => {
    if (!hoveredData) return null;
    return [...hoveredData].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [hoveredData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const formatYAxis = (value: number) => {
    if (value >= 1) {
      return `${Math.round(value)}B`;
    }
    return `${Math.round(value * 1000)}M`;
  };

  if (loading) {
    return (
      <section className="w-full flex flex-col py-6 md:py-12 lg:py-20 px-4 md:px-8 lg:px-[135px]">
        <h1 className="w-full max-w-[766px] font-bold text-white text-2xl md:text-3xl lg:text-[43px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.29px] leading-[normal]">
          NEAR Intents Competitor Comparison
        </h1>
        <p className="w-full max-w-[1170px] mt-2 md:mt-3 lg:mt-[15px] font-normal text-white text-sm md:text-base lg:text-lg tracking-[-0.42px] md:tracking-[-0.48px] lg:tracking-[-0.54px] leading-[normal]">
          This dashboard tracks all-time volume, liquidity depth, assets
          available, chains available, and asset types for the most popular
          cross-chain swapping platforms.
        </p>
        <Card className="w-full max-w-[1170px] mt-4 md:mt-6 lg:mt-[37px] bg-[#0e0e0e] rounded-[18px] border border-solid border-[#343434] overflow-hidden">
          <CardContent className="relative p-0 h-[500px] md:h-[550px] lg:h-[666px]">
            {/* Title skeleton */}
            <div className="absolute top-4 md:top-6 lg:top-[30px] left-4 md:left-6 lg:left-[30px] w-48 h-4 bg-[#1a1a1a] rounded animate-pulse" />

            {/* Volume value skeleton */}
            <div className="absolute top-8 md:top-12 lg:top-[65px] left-4 md:left-6 lg:left-[30px] w-32 h-8 md:h-10 lg:h-14 bg-[#1a1a1a] rounded animate-pulse" />

            {/* Chart area skeleton */}
            <div className="absolute top-20 md:top-24 lg:top-[154px] left-0 md:left-4 lg:left-10 w-[calc(100%-0.25rem)] md:w-[calc(100%-2rem)] lg:w-[844px] h-[380px] md:h-[420px] lg:h-[475px]">
              {/* Horizontal grid lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute w-full h-px bg-[#2a2a2a] animate-pulse"
                  style={{
                    top: `${i * 20}%`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}

              {/* Chart gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent opacity-60" />

              {/* X-axis labels skeleton */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={`x-label-${i}`}
                    className="w-12 h-3 bg-[#1a1a1a] rounded animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            </div>

            {/* Legend skeleton (desktop) */}
            <div className="hidden lg:flex flex-col w-[200px] items-start gap-2 absolute top-[164px] left-[900px]">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={`legend-${i}`}
                  className="flex items-center gap-2 w-full"
                >
                  <div
                    className="w-4 h-4 rounded bg-[#2a2a2a] animate-pulse flex-shrink-0"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                  <div className="flex-1 space-y-1">
                    <div
                      className="h-3 bg-[#1a1a1a] rounded animate-pulse"
                      style={{
                        width: `${60 + Math.random() * 40}%`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                    <div
                      className="h-2 bg-[#1a1a1a] rounded animate-pulse w-16"
                      style={{ animationDelay: `${i * 100 + 50}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Period buttons skeleton (desktop) */}
            <div className="hidden lg:flex gap-2 absolute top-4 md:top-6 lg:top-[30px] right-4 md:right-6 lg:right-[30px]">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={`period-${i}`}
                  className="w-14 h-8 bg-[#1a1a1a] rounded animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="w-full flex flex-col py-6 md:py-12 lg:py-20 px-4 md:px-8 lg:px-[135px]">
      <h1 className="w-full max-w-[766px] font-bold text-white text-2xl md:text-3xl lg:text-[43px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.29px] leading-[normal]">
        NEAR Intents Competitor Comparison
      </h1>

      <p className="w-full max-w-[1170px] mt-2 md:mt-3 lg:mt-[15px] font-normal text-white text-sm md:text-base lg:text-lg tracking-[-0.42px] md:tracking-[-0.48px] lg:tracking-[-0.54px] leading-[normal]">
        This dashboard tracks all-time volume, liquidity depth, assets
        available, chains available, and asset types for the most popular
        cross-chain swapping platforms.
      </p>

      <Card className="w-full max-w-[1170px] mt-4 md:mt-6 lg:mt-[37px] bg-[#0e0e0e] rounded-[18px] border border-solid border-[#343434] overflow-hidden">
        <CardContent className="relative p-0 h-[500px] md:h-[550px] lg:h-[666px]">
          {/* Mobile: Volume + Filters in one row */}
          <div className="flex lg:hidden absolute top-4 left-4 right-4 items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <div className="font-normal text-white text-xs tracking-[-0.36px] leading-tight">
                NEAR Intents Volume
              </div>
              <div className="font-medium text-white text-lg tracking-[-0.72px] leading-tight">
                {nearIntentsTotal}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 px-2.5 flex items-center justify-between gap-1.5 !bg-[#242424] !text-white border-[#343434] hover:!bg-[#343434] text-xs min-w-[100px]"
                  >
                    <span className="font-normal">
                      {selectedCategories.length === 0
                        ? "All"
                        : selectedCategories.join(", ")}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[200px] p-3 !bg-[#1a1a1a] !border-[#343434]"
                >
                  <div className="flex flex-col gap-2">
                    {Array.from(categoryGroups.keys()).map((group) => {
                      const isSelected =
                        selectedCategories.includes(group) ||
                        (group === "All" && selectedCategories.length === 0);
                      return (
                        <div
                          key={group}
                          className="flex items-center gap-2 cursor-pointer hover:bg-[#2a2a2a] p-2 rounded transition-colors"
                          onClick={() => {
                            if (group === "All") {
                              setSelectedCategories([]);
                            } else {
                              setSelectedCategories([group]);
                            }
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            className="border-[#5a5a5a]"
                          />
                          <span className="text-white text-sm">{group}</span>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {periods.map((period) => {
                const isSelected = selectedPeriod === period;
                return (
                  <Button
                    key={period}
                    variant="outline"
                    size="sm"
                    onClick={() => onPeriodChange(period)}
                    className={`h-9 px-2 min-w-[40px] text-xs transition-colors ${
                      isSelected
                        ? "!bg-white !text-black border-white hover:!bg-white hover:!text-black"
                        : "!bg-[#292929] !text-white border-[#343434] hover:!bg-[#343434] hover:!text-white"
                    }`}
                  >
                    <span className="font-normal tracking-[-0.36px]">
                      {period}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Desktop: Volume label and value */}
          <div className="hidden lg:block absolute top-4 md:top-6 lg:top-[30px] left-4 md:left-6 lg:left-[30px] w-auto md:w-auto lg:w-[304px] font-normal text-white text-xs md:text-sm lg:text-base tracking-[-0.36px] md:tracking-[-0.42px] lg:tracking-[-0.48px] leading-[normal]">
            NEAR Intents Volume
          </div>

          <div className="hidden lg:block absolute top-8 md:top-12 lg:top-[65px] left-4 md:left-6 lg:left-[30px] w-auto md:w-auto lg:w-[304px] font-medium text-white text-2xl md:text-3xl lg:text-[50px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.50px] leading-[normal]">
            {nearIntentsTotal}
          </div>

          <div className="absolute top-[90px] md:top-24 lg:top-[154px] left-4 md:left-4 lg:left-10 w-[calc(100%-2rem)] md:w-[calc(100%-2rem)] lg:w-[844px] h-[280px] md:h-[420px] lg:h-[475px] overflow-visible">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={chartData} margin={chartMargin}>
                <CartesianGrid
                  stroke="#343434"
                  strokeDasharray="0"
                  horizontal={true}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#9f9f9f", fontSize: xAxisFontSize }}
                  tickLine={false}
                  axisLine={false}
                  interval={xAxisInterval}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  minTickGap={isMobile ? 5 : 0}
                />
                <YAxis
                  tick={{ fill: "#9f9f9f", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  domain={[0, maxVolume]}
                  ticks={Array.from(
                    { length: Math.ceil(maxVolume) + 1 },
                    (_, i) => i
                  )}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                {providersInfo
                  .filter((provider) => visibleProviders.has(provider.id))
                  .map((provider, index) => (
                    <Line
                      key={provider.id}
                      type="monotone"
                      dataKey={provider.label}
                      stroke={protocolColors[provider.label]}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                      animationDuration={800}
                      animationBegin={index * 100}
                      animationEasing="ease-in-out"
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="hidden lg:block absolute top-[162px] left-[-77px] -rotate-90 font-normal text-white text-base text-center tracking-[-0.48px] leading-[normal] pointer-events-none whitespace-nowrap">
              Cumulative Volume USD
            </div>
          </div>

          <div className="hidden lg:flex flex-col w-[200px] items-start gap-2 absolute top-[164px] left-[900px] max-h-[400px] overflow-y-auto pr-2">
            {legendItems.map((item, index) => (
              <div
                key={`legend-${item.id}`}
                className={`flex items-center gap-2 w-full cursor-pointer hover:bg-[#1a1a1a] p-1 rounded transition-colors ${
                  item.isNearIntents ? "border-l-2 border-[#3ffa90] pl-2" : ""
                }`}
                onClick={() => onToggleProvider(item.id)}
              >
                <div
                  className={`${
                    item.isNearIntents ? "w-5 h-5" : "w-4 h-4"
                  } rounded flex-shrink-0`}
                  style={{
                    backgroundColor: item.color,
                    opacity: item.visible ? 1 : 0.3,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs ${
                      item.isNearIntents ? "font-semibold" : "font-normal"
                    } truncate ${
                      item.visible ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    ${(item.totalVolume / 1_000_000_000).toFixed(2)}B
                  </div>
                </div>
              </div>
            ))}

            {!showAllProviders && filteredProviders.length > 6 && (
              <button
                onClick={() => setShowAllProviders(true)}
                className="w-full text-xs text-blue-400 hover:text-blue-300 py-2 text-center border-t border-[#343434] mt-2"
              >
                + Show {filteredProviders.length - 6} More Providers
              </button>
            )}

            {showAllProviders && filteredProviders.length > 6 && (
              <button
                onClick={() => setShowAllProviders(false)}
                className="w-full text-xs text-blue-400 hover:text-blue-300 py-2 text-center border-t border-[#343434] mt-2"
              >
                - Show Less
              </button>
            )}
          </div>

          {/* Desktop: Category and Period filters */}
          <div className="hidden lg:flex flex-wrap items-center gap-2 absolute top-4 md:top-6 lg:top-[30px] right-4 md:right-6 lg:right-[30px]">
            <span className="text-white text-sm font-normal mr-1">
              Category:
            </span>

            {Array.from(categoryGroups.keys()).map((group) => {
              const isSelected =
                selectedCategories.includes(group) ||
                (group === "All" && selectedCategories.length === 0);
              return (
                <Button
                  key={group}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (group === "All") {
                      setSelectedCategories([]);
                    } else {
                      setSelectedCategories([group]);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "!bg-[#4a4a4a] !text-white border-[#5a5a5a] hover:!bg-[#5a5a5a]"
                      : "!bg-[#242424] !text-white border-[#343434] hover:!bg-[#343434]"
                  }`}
                >
                  {group}
                </Button>
              );
            })}

            <div className="h-6 w-px bg-[#343434]" />

            {periods.map((period) => {
              const isSelected = selectedPeriod === period;
              return (
                <Button
                  key={period}
                  variant="outline"
                  size="sm"
                  onClick={() => onPeriodChange(period)}
                  className={`px-2 md:px-2.5 lg:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm transition-colors ${
                    isSelected
                      ? "!bg-white !text-black border-white hover:!bg-white hover:!text-black"
                      : "!bg-[#292929] !text-white border-[#343434] hover:!bg-[#343434] hover:!text-white"
                  }`}
                >
                  <span className="font-normal text-center tracking-[-0.36px] md:tracking-[-0.42px] leading-[normal]">
                    {period}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="lg:hidden absolute bottom-4 left-4 right-4">
            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1 bg-[#0e0e0e]">
              {legendItems.map((item) => (
                <div
                  key={`legend-mobile-${item.id}`}
                  className={`flex items-center gap-2 w-full cursor-pointer hover:bg-[#1a1a1a] p-1.5 rounded transition-colors ${
                    item.isNearIntents ? "border-l-2 border-[#3ffa90] pl-2" : ""
                  }`}
                  onClick={() => onToggleProvider(item.id)}
                >
                  <div
                    className={`${
                      item.isNearIntents ? "w-4 h-4" : "w-3.5 h-3.5"
                    } rounded flex-shrink-0`}
                    style={{
                      backgroundColor: item.color,
                      opacity: item.visible ? 1 : 0.3,
                    }}
                  />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div
                      className={`text-xs ${
                        item.isNearIntents ? "font-semibold" : "font-normal"
                      } truncate ${
                        item.visible ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {item.label}
                    </div>
                    <div className="text-[10px] text-gray-400 flex-shrink-0">
                      ${(item.totalVolume / 1_000_000_000).toFixed(1)}B
                    </div>
                  </div>
                </div>
              ))}

              {!showAllProviders && filteredProviders.length > (isMobile ? 4 : 6) && (
                <button
                  onClick={() => setShowAllProviders(true)}
                  className="w-full text-sm text-blue-400 hover:text-blue-300 py-2 text-center border-t border-[#343434] mt-1 bg-[#0e0e0e] sticky bottom-0"
                >
                  + Show {filteredProviders.length - (isMobile ? 4 : 6)} More
                </button>
              )}

              {showAllProviders && filteredProviders.length > (isMobile ? 4 : 6) && (
                <button
                  onClick={() => setShowAllProviders(false)}
                  className="w-full text-sm text-blue-400 hover:text-blue-300 py-2 text-center border-t border-[#343434] mt-1 bg-[#0e0e0e] sticky bottom-0"
                >
                  - Show Less
                </button>
              )}
            </div>
          </div>

          {sortedHoveredData &&
            sortedHoveredData.length > 0 &&
            tooltipPosition && (
              <div
                className="inline-flex flex-col gap-2 p-4 absolute rounded border border-solid border-[#343434] bg-[linear-gradient(136deg,rgba(26,26,26,1)_0%,rgba(14,14,14,1)_100%)] z-20 pointer-events-none max-w-[90vw]"
                style={{
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                  transform: "translateY(-50%)",
                  maxWidth: isMobile ? "calc(100vw - 32px)" : "none",
                }}
              >
                {hoveredDate && (
                  <div className="font-semibold text-white text-[11px] tracking-[-0.30px] pb-2 border-b border-[#343434]">
                    {hoveredDate}
                  </div>
                )}
                <div className="inline-flex items-center gap-4 relative flex-[0_0_auto]">
                  <div className="inline-flex flex-col items-start gap-[15px] relative flex-[0_0_auto]">
                    {sortedHoveredData.map((item: any, index: number) => (
                      <div
                        key={`tooltip-label-${index}`}
                        className={`flex items-center gap-[5px] relative ${
                          index === 0 ? "self-stretch w-full" : ""
                        } flex-[0_0_auto]`}
                      >
                        <div
                          className="w-2.5 h-2.5 relative rounded"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="relative w-fit mt-[-1.00px] font-normal text-[10px] tracking-[-0.30px] text-white leading-[normal]">
                          {item.dataKey}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="inline-flex flex-col items-end gap-[15px] relative flex-[0_0_auto]">
                    {sortedHoveredData.map((item: any, index: number) => (
                      <div
                        key={`tooltip-value-${index}`}
                        className={`flex items-center ${
                          index === 0 ? "justify-end self-stretch w-full" : ""
                        } gap-[5px] relative flex-[0_0_auto]`}
                      >
                        <div className="relative w-fit mt-[-1.00px] font-normal text-white text-[10px] tracking-[-0.30px] leading-[normal]">
                          {item.value >= 1
                            ? `$${item.value.toFixed(1)}B`
                            : `$${(item.value * 1000).toFixed(0)}M`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </section>
  );
};
