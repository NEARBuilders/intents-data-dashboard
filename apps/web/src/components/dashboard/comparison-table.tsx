import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";
import type { Route, ProviderInfo } from "@/types/common";
import { useRates, useLiquidity } from "@/hooks/useRouteMetrics";
import { formatRate, formatCurrency, formatPercentage } from "@/utils/comparison";

const selectItemClassName =
  "text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white";

interface ComparisonTableProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  providersInfo: ProviderInfo[];
  loading: boolean;
  selectedRoute: Route | null;
}

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
);

export const ComparisonTable = ({
  selectedProvider,
  onProviderChange,
  providersInfo,
  loading: providersLoading,
  selectedRoute,
}: ComparisonTableProps) => {
  const platforms = useMemo(
    () =>
      providersInfo
        .filter(
          (p) => p.id !== "near_intents" && p.supportedData?.includes("assets")
        )
        .map((p) => ({ value: p.id, label: p.label })),
    [providersInfo]
  );

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

  const loading = providersLoading || ratesLoading || liquidityLoading;

  if (providersLoading) {
    return (
      <section className="relative w-full bg-[#090909] py-10 md:py-12 lg:py-20 overflow-hidden">
        <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
          <header className="mb-8 md:mb-12 lg:mb-[70px]">
            <h2 className="font-bold text-white text-2xl md:text-3xl lg:text-[43px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.29px] leading-normal mb-2 md:mb-3 lg:mb-[14px]">
              Head to Head Comparisons
            </h2>
            <p className="font-normal text-white text-sm md:text-base lg:text-lg tracking-[-0.42px] md:tracking-[-0.48px] lg:tracking-[-0.54px] leading-normal">
              Loading providers...
            </p>
          </header>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full bg-[#090909] py-10 md:py-12 lg:py-20 overflow-hidden">
      <GradientBlur className="top-[461px] left-[-85px] w-52 h-[376px] rounded-[104.12px/187.83px] rotate-[146.01deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
      <GradientBlur className="top-[155px] left-[-213px] w-[330px] h-[445px] rounded-[165.07px/222.48px] rotate-[175.81deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />

      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <header className="mb-8 md:mb-12 lg:mb-[70px]">
          <h2 className="font-bold text-white text-2xl md:text-3xl lg:text-[43px] tracking-[-0.72px] md:tracking-[-0.90px] lg:tracking-[-1.29px] leading-normal mb-2 md:mb-3 lg:mb-[14px]">
            Head to Head Comparisons
          </h2>
          <p className="font-normal text-white text-sm md:text-base lg:text-lg tracking-[-0.42px] md:tracking-[-0.48px] lg:tracking-[-0.54px] leading-normal">
            Compare supported assets between NEAR Intents and other providers.
          </p>
        </header>

        <div className="flex flex-row items-center justify-center gap-2 md:gap-5 lg:gap-6 mb-8 md:mb-12 lg:mb-[92px]">
          <div className="flex items-center gap-3">
            <img
              className="h-8 md:h-14 lg:h-[67px] object-cover"
              alt="NEAR Intents logo"
              src="/images/photopea-online-editor-image-1.png"
            />
          </div>

          <div className="font-bold text-white text-2xl md:text-4xl lg:text-5xl tracking-[-0.60px] md:tracking-[-1.20px] lg:tracking-[-1.44px] leading-normal">
            vs
          </div>

          <Select value={selectedProvider} onValueChange={onProviderChange}>
            <SelectTrigger className="w-[180px] md:w-[240px] lg:w-[290px] h-[36px] md:h-[42px] lg:h-[47px] bg-[#242424] border-[#343434] rounded-[5px] font-normal text-sm md:text-lg lg:text-[21px] tracking-[-0.42px] md:tracking-[-0.54px] lg:tracking-[-0.63px] text-white hover:bg-[#2a2a2a] focus:ring-1 focus:ring-[#343434]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-[#343434]">
              {platforms.map((platform) => (
                <SelectItem
                  key={platform.value}
                  value={platform.value}
                  className={selectItemClassName}
                >
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedRoute ? (
          <div className="text-center text-gray-400 p-8">
            <p>Select a swap pair above to compare rates and liquidity</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-[16px]">
            <Card className="bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b border-[#343434]">
                  <h3 className="font-medium text-xl md:text-2xl tracking-[-0.60px] md:tracking-[-0.72px] text-white">
                    NEAR Intents
                  </h3>
                </div>

                <div className="divide-y divide-[#343434]">
                  {loading ? (
                    <div className="flex items-center justify-center h-32 px-[17px]">
                      <span className="font-normal text-white text-sm">
                        Loading...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Exchange Rate</div>
                        <div className="text-xl text-white font-medium">
                          {formatRate(ratesData?.data?.near_intents?.[0]?.effectiveRate)}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Estimated Cost</div>
                        <div className="text-xl text-white font-medium">
                          {formatCurrency(ratesData?.data?.near_intents?.[0]?.totalFeesUsd)}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Liquidity Depth</div>
                        <div className="text-xl text-white font-medium">
                          {formatPercentage(liquidityData?.data?.near_intents?.[0]?.thresholds?.[0]?.slippageBps)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b border-[#343434]">
                  <h3 className="font-medium text-xl md:text-2xl tracking-[-0.60px] md:tracking-[-0.72px] text-white">
                    {platforms.find((p) => p.value === selectedProvider)?.label ||
                      "Provider"}
                  </h3>
                </div>

                <div className="divide-y divide-[#343434]">
                  {loading ? (
                    <div className="flex items-center justify-center h-32 px-[17px]">
                      <span className="font-normal text-white text-sm">
                        Loading...
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Exchange Rate</div>
                        <div className="text-xl text-white font-medium">
                          {formatRate(ratesData?.data?.[selectedProvider]?.[0]?.effectiveRate)}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Estimated Cost</div>
                        <div className="text-xl text-white font-medium">
                          {formatCurrency(ratesData?.data?.[selectedProvider]?.[0]?.totalFeesUsd)}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-sm text-gray-400 mb-2">Liquidity Depth</div>
                        <div className="text-xl text-white font-medium">
                          {formatPercentage(liquidityData?.data?.[selectedProvider]?.[0]?.thresholds?.[0]?.slippageBps)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
};
