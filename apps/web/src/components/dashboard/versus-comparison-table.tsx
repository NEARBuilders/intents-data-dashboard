import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MetricRow {
  label: string;
  leftValue: string | number | null | undefined;
  rightValue: string | number | null | undefined;
  leftIndicator?: "up" | "down";
  rightIndicator?: "up" | "down";
}

interface VersusComparisonTableProps {
  leftProvider: {
    name: string;
    icon?: string;
  };
  rightProvider: {
    name: string;
    icon?: string;
  };
  metrics: MetricRow[];
  className?: string;
  showProviderSelector?: boolean;
  providerOptions?: Array<{ value: string; label: string }>;
  selectedProvider?: string;
  onProviderChange?: (provider: string) => void;
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
  leftProvider,
  rightProvider,
  metrics,
  className = "",
  showProviderSelector = false,
  providerOptions = [],
  selectedProvider,
  onProviderChange,
}: VersusComparisonTableProps) => {
  return (
    <Card
      className={`bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden max-w-[900px] mx-auto ${className}`}
    >
      <CardContent className="p-0">
        <div className="border-b border-[#343434]">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-6 py-4">
            <div className="flex items-center gap-3 justify-end">
              {leftProvider.icon && (
                <img
                  src={leftProvider.icon}
                  alt={leftProvider.name}
                  className="h-10 md:h-12 lg:h-14 object-cover"
                />
              )}
            </div>

            <div className="flex items-center justify-center px-4">
              <span className="font-bold text-white text-3xl md:text-4xl lg:text-5xl tracking-[-1.44px]">
                vs
              </span>
            </div>

            <div className="flex items-center gap-3 justify-start">
              {showProviderSelector ? (
                <Select value={selectedProvider} onValueChange={onProviderChange}>
                  <SelectTrigger className="w-[200px] lg:w-[240px] h-[42px] bg-[#242424] border-[#343434] rounded-[5px] text-lg tracking-[-0.54px] text-white hover:bg-[#2a2a2a] focus:ring-1 focus:ring-[#343434]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#242424] border-[#343434]">
                    {providerOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  {rightProvider.icon && (
                    <img
                      src={rightProvider.icon}
                      alt={rightProvider.name}
                      className="h-10 md:h-12 lg:h-14 object-cover"
                    />
                  )}
                  <span className="font-medium text-white text-lg tracking-[-0.54px]">
                    {rightProvider.name}
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
              className="grid grid-cols-[1fr_auto_1fr] gap-4 px-6 py-3"
            >
              <div className="flex items-center justify-end">
                <span className="font-medium text-white text-xl">
                  {formatValue(metric.leftValue)}
                </span>
                <IndicatorIcon type={metric.leftIndicator} />
              </div>

              <div className="flex items-center justify-center px-4 min-w-[160px]">
                <span className="text-gray-400 text-sm text-center">
                  {metric.label}
                </span>
              </div>

              <div className="flex items-center justify-start">
                <span className="font-medium text-white text-xl">
                  {formatValue(metric.rightValue)}
                </span>
                <IndicatorIcon type={metric.rightIndicator} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
