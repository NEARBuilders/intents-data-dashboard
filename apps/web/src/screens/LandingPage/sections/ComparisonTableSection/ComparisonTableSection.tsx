import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateFees,
  calculateLiquidityDepth,
  formatMarketCap,
  formatPrice,
  formatVolume,
  getCryptocurrencyData
} from "@/lib/coinmarketcap";
import { useCallback, useEffect, useMemo, useState } from "react";

const selectItemClassName =
  "text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white";

interface ComparisonTableSectionProps {
  providersInfo: any[];
  loading: boolean;
}

const filterOptions = [
  { value: "fees", label: "Fees" },
  { value: "liquidity-depth", label: "Liquidity Depth" },
  { value: "total-volume", label: "Total Volume" },
];

// Map of ticker symbols to icon images
const cryptoIcons: { [key: string]: string } = {
  BTC: "/images/image-1-1.png",
  ETH: "/images/image-2-1.png",
  USDT: "/images/image-3-1.png",
  XRP: "/images/image-4-1.png",
  BNB: "/images/image-5-1.png",
  SOL: "/images/image-6-1.png",
  USDC: "/images/image-7-1.png",
  ZEC: "/images/image-8-1.png",
};

// List of cryptocurrencies to fetch
const CRYPTO_SYMBOLS = [
  "BTC",
  "ETH",
  "USDT",
  "XRP",
  "BNB",
  "SOL",
  "USDC",
  "ZEC",
];

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
);

export const ComparisonTableSection = ({
  providersInfo,
  loading: providersLoading,
}: ComparisonTableSectionProps) => {
  const [selectedFilter, setSelectedFilter] = useState("fees");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [cryptoData, setCryptoData] = useState<
    Array<{
      name: string;
      ticker: string;
      icon: string;
      price: string;
      volume24h: number;
      marketCap: number;
      fees: number;
      liquidityDepth: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const platforms = useMemo(
    () =>
      providersInfo
        .filter((p) => p.id !== "near_intents")
        .map((p) => ({ value: p.id, label: p.label })),
    [providersInfo]
  );

  useEffect(() => {
    if (platforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(platforms[0].value);
    }
  }, [platforms, selectedPlatform]);

  // Handle image load error - fallback to local image
  const handleImageError = useCallback(
    (ticker: string, event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (!imageErrors.has(ticker)) {
        setImageErrors((prev) => new Set(prev).add(ticker));
        const img = event.currentTarget;
        const fallbackIcon = cryptoIcons[ticker] || "/images/image-1-1.png";
        img.src = fallbackIcon;
      }
    },
    [imageErrors]
  );

  // Get display value based on selected filter
  const getDisplayValue = useCallback(
    (crypto: {
      price: string;
      volume24h: number;
      marketCap: number;
      fees: number;
      liquidityDepth: number;
    }): string => {
      switch (selectedFilter) {
        case "fees":
          return formatVolume(crypto.fees);
        case "liquidity-depth":
          return formatMarketCap(crypto.liquidityDepth);
        case "total-volume":
          return formatVolume(crypto.volume24h);
        default:
          return crypto.price;
      }
    },
    [selectedFilter]
  );

  // Get modified data based on selected platform
  // Different platforms may have different multipliers or calculations
  const getPlatformMultiplier = useCallback((platform: string): number => {
    const multipliers: { [key: string]: number } = {
      across: 1.0,
      layerzero: 0.95,
      wormhole: 0.9,
      cctp: 0.85,
      debridge: 0.8,
      axelar: 0.75,
      lifi: 0.7,
      cbridge: 0.65,
    };
    return multipliers[platform] || 1.0;
  }, []);

  // Get modified crypto data for selected platform
  const platformCryptoData = useMemo(() => {
    const multiplier = getPlatformMultiplier(selectedPlatform);
    return cryptoData.map((crypto) => ({
      ...crypto,
      volume24h: crypto.volume24h * multiplier,
      marketCap: crypto.marketCap * multiplier,
      fees: crypto.fees * multiplier,
      liquidityDepth: crypto.liquidityDepth * multiplier,
    }));
  }, [cryptoData, selectedPlatform, getPlatformMultiplier]);

  useEffect(() => {
    const fetchCryptoData = async () => {
      try {
        setLoading(true);
        const data = await getCryptocurrencyData(CRYPTO_SYMBOLS);

        const formattedData = data.map((crypto) => {
          const volume24h = crypto.quote.USD.volume_24h || 0;
          const marketCap = crypto.quote.USD.market_cap || 0;

          const icon =
            cryptoIcons[crypto.symbol] ||
            crypto.logo ||
            "/images/image-1-1.png";

          return {
            name: crypto.name,
            ticker: crypto.symbol,
            icon,
            price: formatPrice(crypto.quote.USD.price),
            volume24h,
            marketCap,
            fees: calculateFees(marketCap, volume24h),
            liquidityDepth: calculateLiquidityDepth(marketCap),
          };
        });

        setCryptoData(formattedData);
      } catch (error) {
        console.error("Error fetching cryptocurrency data:", error);
        // Fallback to empty array - API will provide mock data
        setCryptoData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCryptoData();

    // Refresh data every 5 minutes
    const interval = setInterval(fetchCryptoData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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
            Select a cross-chain swap platform to compare with NEAR Intents.
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

          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
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
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0 p-4 border-b border-[#343434]">
                <h3 className="font-medium text-xl md:text-2xl tracking-[-0.60px] md:tracking-[-0.72px] text-white">
                  NEAR Intents
                </h3>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <span className="font-medium text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px]">
                    Filter By
                  </span>
                  <Select
                    value={selectedFilter}
                    onValueChange={setSelectedFilter}
                  >
                    <SelectTrigger className="flex-1 md:w-[200px] h-[35px] bg-[#242424] border-[#343434] rounded-[5px] hover:bg-[#2a2a2a] focus:ring-1 focus:ring-[#343434]">
                      <SelectValue
                        placeholder="Select a filter..."
                        className="font-normal text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px]"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-[#242424] border-[#343434]">
                      {filterOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className={selectItemClassName}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="divide-y divide-[#343434]">
                {loading ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-white text-sm">
                      Loading...
                    </span>
                  </div>
                ) : (
                  cryptoData.map((crypto, index) => (
                    <div
                      key={`near-${index}`}
                      className="flex items-center h-12 px-[17px] bg-[#0e0e0e] border-b border-[#343434]"
                    >
                      <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-[#756f6f] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                          <img
                            className="w-5 h-5 md:w-6 md:h-6 object-cover"
                            alt={crypto.name}
                            src={
                              imageErrors.has(crypto.ticker)
                                ? cryptoIcons[crypto.ticker] ||
                                  "/images/image-1-1.png"
                                : crypto.icon
                            }
                            onError={(e) => handleImageError(crypto.ticker, e)}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                          <span className="font-medium text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px] truncate">
                            {crypto.name}
                          </span>
                          <span className="font-medium text-[#8b8b8b] text-xs md:text-[13px] tracking-[-0.36px] md:tracking-[-0.39px] flex-shrink-0">
                            {crypto.ticker}
                          </span>
                        </div>
                      </div>
                      <div className="font-normal text-white text-sm md:text-base text-right tracking-[-0.42px] md:tracking-[-0.48px] flex-shrink-0">
                        {getDisplayValue(crypto)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0e0e0e] border-[#343434] rounded-[14px] overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center p-4 border-b border-[#343434]">
                <h3 className="font-medium text-xl md:text-2xl tracking-[-0.60px] md:tracking-[-0.72px] text-white">
                  {platforms.find((p) => p.value === selectedPlatform)?.label ||
                    "Across Protocol"}
                </h3>
              </div>

              <div className="divide-y divide-[#343434]">
                {loading ? (
                  <div className="flex items-center justify-center h-12 px-[17px]">
                    <span className="font-normal text-white text-sm">
                      Loading...
                    </span>
                  </div>
                ) : (
                  platformCryptoData.map((crypto, index) => (
                    <div
                      key={`across-${index}`}
                      className="flex items-center h-12 px-[17px] bg-[#0e0e0e] border-b border-[#343434]"
                    >
                      <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-[#756f6f] rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                          <img
                            className="w-5 h-5 md:w-6 md:h-6 object-cover"
                            alt={crypto.name}
                            src={
                              imageErrors.has(crypto.ticker)
                                ? cryptoIcons[crypto.ticker] ||
                                  "/images/image-1-1.png"
                                : crypto.icon
                            }
                            onError={(e) => handleImageError(crypto.ticker, e)}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0">
                          <span className="font-medium text-white text-sm md:text-base tracking-[-0.42px] md:tracking-[-0.48px] truncate">
                            {crypto.name}
                          </span>
                          <span className="font-medium text-[#8b8b8b] text-xs md:text-[13px] tracking-[-0.36px] md:tracking-[-0.39px] flex-shrink-0">
                            {crypto.ticker}
                          </span>
                        </div>
                      </div>
                      <div className="font-normal text-white text-sm md:text-base text-right tracking-[-0.42px] md:tracking-[-0.48px] flex-shrink-0">
                        {getDisplayValue(crypto)}
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
