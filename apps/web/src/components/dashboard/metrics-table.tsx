import { Fragment } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TREND_ICON_SIZE = "w-5 h-5";
const TREND_COLORS = {
  down: "text-[#ffcccc]",
  up: "text-[#aeffed]",
};

const dataRows = [
  {
    label: "Assets",
    nearValue: "117",
    nearColor: "text-[#ffcccc]",
    nearTrend: "down",
    acrossValue: "1134",
    acrossColor: "text-[#aeffed]",
    acrossTrend: "up",
  },
  {
    label: "Chains",
    nearValue: "23",
    nearColor: "text-[#aeffed]",
    nearTrend: "up",
    acrossValue: "18",
    acrossColor: "text-[#ffcccc]",
    acrossTrend: "down",
  },
  {
    label: "Native / Wrapped Assets Ratio",
    nearValue: "23:1",
    nearColor: "text-white",
    nearTrend: null,
    acrossValue: "345:343",
    acrossColor: "text-white",
    acrossTrend: null,
  },
  {
    label: "1D Volume",
    nearValue: "5.4B$",
    nearColor: "text-[#ffcccc]",
    nearTrend: "down",
    acrossValue: "$528.3B",
    acrossColor: "text-[#aeffed]",
    acrossTrend: "up",
  },
  {
    label: "30D Volume",
    nearValue: "5.4B$",
    nearColor: "text-[#ffcccc]",
    nearTrend: "down",
    acrossValue: "$528.3B",
    acrossColor: "text-[#aeffed]",
    acrossTrend: "up",
  },
  {
    label: "All-Time Volume",
    nearValue: "5.4B$",
    nearColor: "text-[#ffcccc]",
    nearTrend: "down",
    acrossValue: "$528.3B",
    acrossColor: "text-[#aeffed]",
    acrossTrend: "up",
  },
];

export const MetricsTable = () => {
  return (
    <section className="w-full flex justify-center py-4 px-4 md:px-6 lg:px-0">
      <Card className="w-full max-w-[844px] bg-[#0e0e0e] rounded-[14px] border border-[#343434] overflow-hidden">
        <CardContent className="p-0">
          {/* Desktop/Tablet Header */}
          <div className="hidden md:grid grid-cols-2 h-[57px] items-center relative">
            <div className="flex items-center justify-center h-full px-4">
              <span className="font-medium text-white text-[22px] text-center tracking-[-0.66px] leading-normal">
                NEAR Intents
              </span>
            </div>
            <div className="flex items-center justify-center h-full px-4 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-[#343434]" />
              <span className="font-medium text-white text-[22px] text-center tracking-[-0.66px] leading-normal">
                Across Protocol
              </span>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden flex flex-col py-3 px-4 border-b border-[#343434]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white text-lg tracking-[-0.54px]">
                NEAR Intents
              </span>
              <span className="font-medium text-white text-lg tracking-[-0.54px]">
                Across Protocol
              </span>
            </div>
          </div>

          <Separator className="bg-[#343434]" />

          {dataRows.map((row, index) => (
            <Fragment key={index}>
              {/* Desktop/Tablet Row */}
              <div className="hidden md:grid grid-cols-3 h-[52px] items-center">
                <div className="flex items-center justify-center h-full px-4 gap-2">
                  <span
                    className={`font-medium text-[22px] text-center tracking-[-0.66px] leading-normal ${row.nearColor}`}
                  >
                    {row.nearValue}
                  </span>
                  {row.nearTrend === "down" && (
                    <ArrowDownIcon className={`${TREND_ICON_SIZE} ${TREND_COLORS.down}`} />
                  )}
                  {row.nearTrend === "up" && (
                    <ArrowUpIcon className={`${TREND_ICON_SIZE} ${TREND_COLORS.up}`} />
                  )}
                </div>
                <div className="flex items-center justify-center h-full px-4">
                  <span className="font-medium text-[#8b8b8b] text-base text-center tracking-[-0.48px] leading-normal">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center justify-center h-full px-4 gap-2">
                  <span
                    className={`font-medium text-[22px] text-center tracking-[-0.66px] leading-normal ${row.acrossColor}`}
                  >
                    {row.acrossValue}
                  </span>
                  {row.acrossTrend === "down" && (
                    <ArrowDownIcon className={`${TREND_ICON_SIZE} ${TREND_COLORS.down}`} />
                  )}
                  {row.acrossTrend === "up" && (
                    <ArrowUpIcon className={`${TREND_ICON_SIZE} ${TREND_COLORS.up}`} />
                  )}
                </div>
              </div>

              {/* Mobile Row */}
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
                      <ArrowDownIcon className={`w-4 h-4 ${TREND_COLORS.down}`} />
                    )}
                    {row.nearTrend === "up" && (
                      <ArrowUpIcon className={`w-4 h-4 ${TREND_COLORS.up}`} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium text-lg tracking-[-0.54px] ${row.acrossColor}`}
                    >
                      {row.acrossValue}
                    </span>
                    {row.acrossTrend === "down" && (
                      <ArrowDownIcon className={`w-4 h-4 ${TREND_COLORS.down}`} />
                    )}
                    {row.acrossTrend === "up" && (
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
};
