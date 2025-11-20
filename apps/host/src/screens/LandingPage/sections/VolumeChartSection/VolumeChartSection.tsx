import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const legendItems = [
  { color: "bg-[#3ffa90]", label: "NEAR Intents" },
  { color: "bg-[#0066ff]", label: "LayerZero" },
  { color: "bg-[#7f1dff]", label: "WormHole" },
  { color: "bg-[#ff262a]", label: "CCTP" },
  { color: "bg-[#fa00ff]", label: "Across Protocol" },
  { color: "bg-[#e9ff02]", label: "deBridge" },
  { color: "bg-[#ff8d23]", label: "Axelar" },
  { color: "bg-[#49ffef]", label: "Li.Fi" },
  { color: "bg-[#dfdfdf]", label: "cBridge" },
];


const xAxisLabels = [
  "Nov 2024",
  "Dec 2024",
  "Jan 2025",
  "Mar 2025",
  "Apr 2025",
  "Jun 2025",
  "Jul 2025",
  "Aug 2025",
  "Oct 2025",
  "Nov 2025",
];

// Pre-generated static data with different levels for each protocol
const generateStaticChartData = () => {
  // Different starting levels and growth patterns for each protocol
  const protocolData: { [key: string]: { start: number; growth: number; pattern: number[] } } = {
    "NEAR Intents": { start: 0.2, growth: 0.45, pattern: [0.2, 0.8, 1.5, 2.3, 3.2, 4.1, 4.8, 5.2, 5.4, 5.4] },
    "LayerZero": { start: 0.3, growth: 0.38, pattern: [0.3, 0.9, 1.6, 2.4, 3.1, 3.8, 4.3, 4.6, 4.8, 4.9] },
    "WormHole": { start: 0.25, growth: 0.32, pattern: [0.25, 0.7, 1.3, 2.0, 2.6, 3.2, 3.7, 4.0, 4.2, 4.3] },
    "CCTP": { start: 0.2, growth: 0.28, pattern: [0.2, 0.6, 1.1, 1.7, 2.2, 2.7, 3.1, 3.4, 3.6, 3.7] },
    "Across Protocol": { start: 0.18, growth: 0.30, pattern: [0.18, 0.65, 1.2, 1.8, 2.4, 3.0, 3.5, 3.8, 4.0, 4.1] },
    "deBridge": { start: 0.15, growth: 0.24, pattern: [0.15, 0.5, 0.9, 1.4, 1.9, 2.3, 2.7, 3.0, 3.2, 3.3] },
    "Axelar": { start: 0.12, growth: 0.20, pattern: [0.12, 0.4, 0.7, 1.1, 1.5, 1.9, 2.2, 2.4, 2.6, 2.7] },
    "Li.Fi": { start: 0.1, growth: 0.18, pattern: [0.1, 0.35, 0.6, 0.9, 1.2, 1.5, 1.8, 2.0, 2.1, 2.2] },
    "cBridge": { start: 0.08, growth: 0.15, pattern: [0.08, 0.3, 0.5, 0.8, 1.0, 1.3, 1.5, 1.7, 1.8, 1.9] },
  };

  return xAxisLabels.map((label, index) => {
    const dataPoint: { [key: string]: any } = { name: label };
    Object.keys(protocolData).forEach((protocol) => {
      const data = protocolData[protocol];
      // Use pattern if available, otherwise calculate
      const value = data.pattern[index] || (data.start * (1 + data.growth * index));
      dataPoint[protocol] = Math.max(0, Math.min(value, 5.5));
    });
    return dataPoint;
  });
};

// Chart data for each protocol - generating realistic cumulative volume data
const generateChartData = (period: string) => {
  const baseData = generateStaticChartData();

  // Adjust data based on period
  if (period === "7D") {
    return baseData.slice(-2);
  } else if (period === "30D") {
    return baseData.slice(-3);
  } else if (period === "90D") {
    return baseData.slice(-4);
  }
  return baseData;
};

const protocolColors: { [key: string]: string } = {
  "NEAR Intents": "#3ffa90",
  "LayerZero": "#0066ff",
  "WormHole": "#7f1dff",
  "CCTP": "#ff262a",
  "Across Protocol": "#fa00ff",
  "deBridge": "#e9ff02",
  "Axelar": "#ff8d23",
  "Li.Fi": "#49ffef",
  "cBridge": "#dfdfdf",
};

const periods = ["7D", "30D", "90D", "ALL"];

export const VolumeChartSection = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const chartData = useMemo(() => generateChartData(selectedPeriod), [selectedPeriod]);

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
            $5.4B
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
                  domain={[0, 5.5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  width={30}
                />
                <Tooltip content={<CustomTooltip />} />
                {Object.keys(protocolColors).map((protocol) => (
                  <Line
                    key={protocol}
                    type="monotone"
                    dataKey={protocol}
                    stroke={protocolColors[protocol]}
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

          <div className="hidden lg:flex flex-col w-[150px] items-start gap-[15px] absolute top-[164px] left-[900px]">
            {legendItems.map((item, index) => (
              <div
                key={`legend-${index}`}
                className={`flex items-center gap-[5px] relative ${index === 0 ? "self-stretch w-full" : ""} flex-[0_0_auto] ${index === 4 ? "mr-[-18.00px]" : ""}`}
              >
                <div className={`w-5 h-5 ${item.color} relative rounded`} />
                <div className="relative w-fit mt-[-1.00px] font-normal text-white text-base tracking-[-0.48px] leading-[normal]">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div className="lg:hidden absolute bottom-4 left-4 right-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3 justify-items-start">
              {legendItems.map((item, index) => (
                <div
                  key={`legend-mobile-${index}`}
                  className="flex items-center gap-1.5 justify-start w-full"
                >
                  <div className={`w-3 h-3 ${item.color} relative rounded flex-shrink-0`} />
                  <div className="relative w-fit font-normal text-white text-xs md:text-sm tracking-[-0.36px] md:tracking-[-0.42px] leading-[normal] truncate">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 absolute top-4 md:top-6 lg:top-[30px] right-4 md:right-6 lg:right-[30px]">
            {periods.map((period) => {
              const isSelected = selectedPeriod === period;
              return (
              <Button
                key={period}
                  variant="outline"
                size="sm"
                onClick={() => setSelectedPeriod(period)}
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
