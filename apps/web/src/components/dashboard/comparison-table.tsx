import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { client } from "@/utils/orpc";
import { useMemo, useState, useEffect } from "react";

const selectItemClassName =
  "text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white";

interface ComparisonTableProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  providersInfo: any[];
  loading: boolean;
}

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
);

export const ComparisonTable = ({
  selectedProvider,
  onProviderChange,
  providersInfo,
  loading: providersLoading,
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

  const { data: assetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ["assets", "near_intents", selectedProvider],
    queryFn: () =>
      client.getListedAssets({
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

  const loading = providersLoading || assetsLoading;

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 lg:gap-[16px]">
          <Card className="bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-4 border-b border-[#343434]">
                <h3 className="font-medium text-xl md:text-2xl tracking-[-0.60px] md:tracking-[-0.72px] text-white">
                  NEAR Intents
                </h3>
                <span className="text-sm text-gray-400">
                  {nearIntentsAssets.length} assets
                </span>
              </div>

              <div className="divide-y divide-[#343434] max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-white text-sm">
                      Loading...
                    </span>
                  </div>
                ) : nearIntentsAssets.length === 0 ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-gray-400 text-sm">
                      No assets available
                    </span>
                  </div>
                ) : (
                  nearIntentsAssets.map((asset: any, index: number) => (
                    <div
                      key={`near-${asset.assetId}-${index}`}
                      className="flex items-center h-12 px-[17px] bg-[#0e0e0e] border-b border-[#343434]"
                    >
                      <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-[#756f6f] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                          {asset.iconUrl ? (
                            <img
                              className="w-5 h-5 md:w-6 md:h-6 object-cover"
                              alt={asset.symbol}
                              src={asset.iconUrl}
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.style.display = "none";
                              }}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-xs text-white font-medium">
                              {asset.symbol.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                          <span className="font-medium text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px] truncate">
                            {asset.symbol}
                          </span>
                          <span className="font-medium text-[#8b8b8b] text-xs md:text-[13px] tracking-[-0.36px] md:tracking-[-0.39px] flex-shrink-0">
                            {asset.blockchain}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
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
                <span className="text-sm text-gray-400">
                  {selectedProviderAssets.length} assets
                </span>
              </div>

              <div className="divide-y divide-[#343434] max-h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-white text-sm">
                      Loading...
                    </span>
                  </div>
                ) : selectedProviderAssets.length === 0 ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-gray-400 text-sm">
                      No assets available
                    </span>
                  </div>
                ) : (
                  selectedProviderAssets.map((asset: any, index: number) => (
                    <div
                      key={`selected-${asset.assetId}-${index}`}
                      className="flex items-center h-12 px-[17px] bg-[#0e0e0e] border-b border-[#343434]"
                    >
                      <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-[#756f6f] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                          {asset.iconUrl ? (
                            <img
                              className="w-5 h-5 md:w-6 md:h-6 object-cover"
                              alt={asset.symbol}
                              src={asset.iconUrl}
                              onError={(e) => {
                                const img = e.currentTarget;
                                img.style.display = "none";
                              }}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="text-xs text-white font-medium">
                              {asset.symbol.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                          <span className="font-medium text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px] truncate">
                            {asset.symbol}
                          </span>
                          <span className="font-medium text-[#8b8b8b] text-xs md:text-[13px] tracking-[-0.36px] md:tracking-[-0.39px] flex-shrink-0">
                            {asset.blockchain}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
