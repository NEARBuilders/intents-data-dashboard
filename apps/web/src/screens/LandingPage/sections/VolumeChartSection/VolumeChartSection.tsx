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

interface VolumeChartSectionProps {
  volumeData?: any
  providersInfo: any[]
  loading: boolean
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  visibleProviders: Set<string>
  onToggleProvider: (id: string) => void
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const transformToCumulativeData = (volumeData: any, providersInfo: any[], visibleProviders: Set<string>) => {
  if (!volumeData?.data) return [];

  console.log('Volume Data Debug:', {
    providers: volumeData.providers,
    sampleNearIntents: volumeData.data['near_intents']?.slice(0, 3),
    totalNearIntents: volumeData.data['near_intents']?.reduce((sum: number, dv: any) => sum + dv.volumeUsd, 0),
  });

  const allDates = new Set<string>();
  Object.values(volumeData.data).forEach((dailyVolumes: any) => {
    if (Array.isArray(dailyVolumes)) {
      dailyVolumes.forEach((dv: any) => allDates.add(dv.date));
    }
  });
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create date -> volume maps for each provider for O(1) lookups
  const providerVolumesByDate = new Map<string, Map<string, number>>();
  providersInfo.forEach(provider => {
    if (!visibleProviders.has(provider.id)) return;
    
    const volumeMap = new Map<string, number>();
    const providerVolumes = volumeData.data[provider.id] || [];
    
    providerVolumes.forEach((dv: any) => {
      volumeMap.set(dv.date, dv.volumeUsd);
    });
    
    providerVolumesByDate.set(provider.id, volumeMap);
  });
  
  // Calculate cumulative volumes in a single pass
  const cumulativesByProvider = new Map<string, number>();
  
  const chartData = sortedDates.map(date => {
    const dataPoint: any = { name: formatDate(date) };
    
    providersInfo.forEach(provider => {
      if (!visibleProviders.has(provider.id)) return;
      
      const volumeMap = providerVolumesByDate.get(provider.id);
      const todayVolume = volumeMap?.get(date) || 0;
      
      const currentCumulative = cumulativesByProvider.get(provider.id) || 0;
      const newCumulative = currentCumulative + todayVolume;
      
      cumulativesByProvider.set(provider.id, newCumulative);
      dataPoint[provider.label] = newCumulative / 1_000_000_000;
    });
    
    return dataPoint;
  });
  
  return chartData;
};

const periods = ["7D", "30D", "90D", "ALL"];

export const VolumeChartSection = ({
  volumeData,
  providersInfo,
  loading,
  selectedPeriod,
  onPeriodChange,
  visibleProviders,
  onToggleProvider,
}: VolumeChartSectionProps) => {
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const hoverTimeoutRef = useRef<number | null>(null);

  const providerTotals = useMemo(() => {
    if (!volumeData?.data) return [];
    
    return providersInfo.map(provider => {
      const volumes = volumeData.data[provider.id] || [];
      const total = volumes.reduce((sum: number, dv: any) => sum + dv.volumeUsd, 0);
      return { ...provider, totalVolume: total };
    })
    .sort((a, b) => {
      if (a.id === 'near_intents') return -1;
      if (b.id === 'near_intents') return 1;
      return b.totalVolume - a.totalVolume;
    });
  }, [volumeData, providersInfo]);

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    groups.set('All', []);
    groups.set('Aggregators', ['Bridge Aggregator']);
    groups.set('Bridges', ['Pool-based Bridge', 'Other Bridge']);
    groups.set('Clearing', ['Clearing Protocol']);
    groups.set('GMP', ['GMP']);
    groups.set('Intent-based', ['Intent-based Bridge']);
    return groups;
  }, []);

  const filteredProviders = useMemo(() => {
    const nearIntents = providerTotals.find(p => p.id === 'near_intents');
    
    let filtered = providerTotals.filter(p => p.id !== 'near_intents');
    
    if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
      const categoriesToFilter: string[] = [];
      selectedCategories.forEach(group => {
        const cats = categoryGroups.get(group);
        if (cats && cats.length > 0) {
          categoriesToFilter.push(...cats);
        }
      });
      filtered = filtered.filter(p => categoriesToFilter.includes(p.category));
    }
    
    return nearIntents ? [nearIntents, ...filtered] : filtered;
  }, [providerTotals, selectedCategories, categoryGroups]);

  const displayedProviders = useMemo(() => {
    return showAllProviders ? filteredProviders : filteredProviders.slice(0, 6);
  }, [filteredProviders, showAllProviders]);

  const chartData = useMemo(() => 
    transformToCumulativeData(volumeData, displayedProviders, visibleProviders),
    [volumeData, displayedProviders, visibleProviders]
  );

  const protocolColors = useMemo(() => {
    const colors: { [key: string]: string } = {};
    displayedProviders.forEach(provider => {
      if (provider.id === 'near_intents') {
        colors[provider.label] = '#3ffa90';
      } else {
        colors[provider.label] = generateProviderColor(provider.id);
      }
    });
    return colors;
  }, [displayedProviders]);

  const legendItems = useMemo(() => 
    displayedProviders.map(provider => ({
      id: provider.id,
      label: provider.label,
      color: provider.id === 'near_intents' ? '#3ffa90' : generateProviderColor(provider.id),
      visible: visibleProviders.has(provider.id),
      totalVolume: provider.totalVolume,
      category: provider.category,
      isNearIntents: provider.id === 'near_intents',
    })),
    [displayedProviders, visibleProviders]
  );

  const maxVolume = useMemo(() => {
    if (chartData.length === 0) return 5.5;
    let max = 0;
    chartData.forEach(dataPoint => {
      Object.keys(dataPoint).forEach(key => {
        if (key !== 'name' && typeof dataPoint[key] === 'number') {
          max = Math.max(max, dataPoint[key]);
        }
      });
    });
    return Math.ceil(max * 1.1);
  }, [chartData]);

  const nearIntentsTotal = useMemo(() => {
    if (!chartData.length) return "$0B";
    const lastDataPoint = chartData[chartData.length - 1];
    const nearIntentsProvider = providersInfo.find(p => p.id === "near_intents");
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
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Responsive margin for mobile
  const chartMargin = useMemo(() => {
    if (isMobile) {
      return { top: 5, right: 5, left: 0, bottom: 60 };
    }
    return { top: 5, right: 30, left: 30, bottom: 60 };
  }, [isMobile]);

  // Responsive XAxis config for mobile
  const xAxisInterval = isMobile ? 1 : 0; // Show every other label on mobile
  const xAxisFontSize = isMobile ? 7 : 8;

  // Throttle tooltip updates to prevent excessive re-renders
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 16; // ~60fps

  const handleTooltipChange = useCallback((active: boolean, payload: any, coordinate?: { x: number; y: number }) => {
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
      const tooltipY = topOffset + (chartHeight - xAxisHeight - tooltipHeight / 2 - 80);
      
      let tooltipX = coordinate.x + leftOffset + 20; // Add 20px for tooltip padding
      
      // Ensure tooltip stays within viewport bounds (only adjust horizontal position)
      if (typeof window !== 'undefined') {
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
  }, [isMobile]);

  const CustomTooltip = useCallback(({ active, payload, coordinate }: any) => {
    // Use requestAnimationFrame to avoid state updates during render
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        handleTooltipChange(active, payload, coordinate);
      });
    }
    return null;
  }, [handleTooltipChange]);

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
        <Card className="w-full max-w-[1170px] mt-4 md:mt-6 lg:mt-[37px] bg-[#0e0e0e] rounded-[18px] border border-solid border-[#343434]">
          <CardContent className="h-[500px] md:h-[550px] lg:h-[666px] flex items-center justify-center">
            <span className="text-white text-lg">Loading volume data...</span>
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
          <div className="absolute top-4 md:top-6 lg:top-[30px] left-4 md:left-6 lg:left-[30px] w-auto md:w-auto lg:w-[304px] font-normal text-white text-xs md:text-sm lg:text-base tracking-[-0.36px] md:tracking-[-0.42px] lg:tracking-[-0.48px] leading-[normal]">
            NEAR Intents All-Time Volume
          </div>

          <div className="absolute top-8 md:top-12 lg:top-[65px] left-4 md:left-6 lg:left-[30px] w-auto md:w-auto lg:w-[304px] font-medium text-white text-2xl md:text-3xl lg:text-[50px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.50px] leading-[normal]">
            {nearIntentsTotal}
          </div>

          <div className="absolute top-20 md:top-24 lg:top-[154px] left-0 md:left-4 lg:left-10 w-[calc(100%-0.25rem)] md:w-[calc(100%-2rem)] lg:w-[844px] h-[380px] md:h-[420px] lg:h-[475px] overflow-visible">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart
                data={chartData}
                margin={chartMargin}
              >
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
                  angle={0}
                  textAnchor="middle"
                  height={60}
                  minTickGap={isMobile ? 5 : 0}
                />
                <YAxis
                  tick={{ fill: "#9f9f9f", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  domain={[0, maxVolume]}
                  ticks={Array.from({ length: Math.ceil(maxVolume) + 1 }, (_, i) => i)}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                {providersInfo
                  .filter(provider => visibleProviders.has(provider.id))
                  .map((provider) => (
                    <Line
                      key={provider.id}
                      type="monotone"
                      dataKey={provider.label}
                      stroke={protocolColors[provider.label]}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
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
                  item.isNearIntents ? 'border-l-2 border-[#3ffa90] pl-2' : ''
                }`}
                onClick={() => onToggleProvider(item.id)}
              >
                <div 
                  className={`${item.isNearIntents ? 'w-5 h-5' : 'w-4 h-4'} rounded flex-shrink-0`}
                  style={{ backgroundColor: item.color, opacity: item.visible ? 1 : 0.3 }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${item.isNearIntents ? 'font-semibold' : 'font-normal'} truncate ${item.visible ? 'text-white' : 'text-gray-500'}`}>
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

          <div className="flex lg:hidden flex-wrap items-center gap-2 absolute top-4 right-4 left-4">
            <span className="text-white text-xs font-normal w-full mb-1">Category:</span>
            
            {Array.from(categoryGroups.keys()).map((group) => {
              const isSelected = selectedCategories.includes(group) || (group === 'All' && selectedCategories.length === 0);
              return (
                <Button
                  key={group}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (group === 'All') {
                      setSelectedCategories([]);
                    } else {
                      setSelectedCategories([group]);
                    }
                  }}
                  className={`px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? "!bg-[#4a4a4a] !text-white border-[#5a5a5a]"
                      : "!bg-[#242424] !text-white border-[#343434]"
                  }`}
                >
                  {group}
                </Button>
              );
            })}
            
            <div className="h-px w-full bg-[#343434] my-1" />
            
            {periods.map((period) => {
              const isSelected = selectedPeriod === period;
              return (
              <Button
                key={period}
                variant="outline"
                size="sm"
                onClick={() => onPeriodChange(period)}
                className={`px-2 py-1 text-xs transition-colors ${
                  isSelected
                    ? "!bg-white !text-black border-white hover:!bg-white hover:!text-black"
                    : "!bg-[#292929] !text-white border-[#343434] hover:!bg-[#343434] hover:!text-white"
                }`}
              >
                <span className="font-normal text-center tracking-[-0.36px] leading-[normal]">
                  {period}
                </span>
              </Button>
              );
            })}
          </div>

          <div className="lg:hidden absolute bottom-4 left-4 right-4">
            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
              {legendItems.map((item) => (
                <div
                  key={`legend-mobile-${item.id}`}
                  className={`flex items-center gap-1.5 w-full cursor-pointer hover:opacity-80 transition-opacity ${
                    item.isNearIntents ? 'border-l-2 border-[#3ffa90] pl-1' : ''
                  }`}
                  onClick={() => onToggleProvider(item.id)}
                >
                  <div 
                    className={`${item.isNearIntents ? 'w-4 h-4' : 'w-3 h-3'} rounded flex-shrink-0`}
                    style={{ backgroundColor: item.color, opacity: item.visible ? 1 : 0.3 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] ${item.isNearIntents ? 'font-semibold' : 'font-normal'} truncate ${item.visible ? 'text-white' : 'text-gray-500'}`}>
                      {item.label}
                    </div>
                    <div className="text-[8px] text-gray-400">
                      ${(item.totalVolume / 1_000_000_000).toFixed(1)}B
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {!showAllProviders && filteredProviders.length > 6 && (
              <button
                onClick={() => setShowAllProviders(true)}
                className="w-full text-xs text-blue-400 py-2 text-center border-t border-[#343434] mt-2"
              >
                + Show {filteredProviders.length - 6} More
              </button>
            )}
          </div>

          <div className="hidden lg:flex flex-wrap items-center gap-2 absolute top-4 md:top-6 lg:top-[30px] right-4 md:right-6 lg:right-[30px]">
            <span className="text-white text-sm font-normal mr-1">Category:</span>
            
            {Array.from(categoryGroups.keys()).map((group) => {
              const isSelected = selectedCategories.includes(group) || (group === 'All' && selectedCategories.length === 0);
              return (
                <Button
                  key={group}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (group === 'All') {
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

          {hoveredData && hoveredData.length > 0 && tooltipPosition && (
            <div 
              className="inline-flex items-center gap-2.5 p-4 absolute rounded border border-solid border-[#343434] bg-[linear-gradient(136deg,rgba(26,26,26,1)_0%,rgba(14,14,14,1)_100%)] z-20 pointer-events-none max-w-[90vw]"
              style={{
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y}px`,
                transform: 'translateY(-50%)',
                maxWidth: isMobile ? 'calc(100vw - 32px)' : 'none',
              }}
            >
            <div className="inline-flex items-center gap-4 relative flex-[0_0_auto]">
              <div className="inline-flex flex-col items-start gap-[15px] relative flex-[0_0_auto]">
                  {hoveredData.map((item: any, index: number) => (
                  <div
                    key={`tooltip-label-${index}`}
                    className={`flex items-center gap-[5px] relative ${index === 0 ? "self-stretch w-full" : ""} flex-[0_0_auto]`}
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
                  {hoveredData.map((item: any, index: number) => (
                  <div
                    key={`tooltip-value-${index}`}
                    className={`flex items-center ${index === 0 ? "justify-end self-stretch w-full" : ""} gap-[5px] relative flex-[0_0_auto]`}
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
