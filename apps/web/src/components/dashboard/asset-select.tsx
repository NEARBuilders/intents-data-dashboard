import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMemo, useState, useEffect } from "react";
import type { Asset } from "@/types/common";
import type { CoinGeckoTokenListToken } from "@/lib/coingecko/types";
import { logEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const BLUE_CHIP_SYMBOLS = [
  "ETH",
  "WETH",
  "WBTC",
  "BTC",
  "USDC",
  "USDT",
  "DAI",
  "BUSD",
];

interface AssetSections {
  blueChips: Asset[];
  topByMarketCap: Asset[];
  others: Asset[];
}

interface AssetSelectProps {
  label: string;
  value?: string;
  onChange: (assetId: string) => void;
  assets: Asset[];
  tokens?: CoinGeckoTokenListToken[];
  networkId?: string;
  direction: "source" | "destination";
  disabled?: boolean;
  loading?: boolean;
}

export const AssetSelect = ({
  label,
  value,
  onChange,
  assets,
  tokens,
  networkId,
  direction,
  disabled,
  loading,
}: AssetSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sections = useMemo((): AssetSections => {
    if (!tokens || tokens.length === 0) {
      return {
        blueChips: [],
        topByMarketCap: [],
        others: assets,
      };
    }

    const tokenById = new Map(tokens.map((t) => [t.symbol.toLowerCase(), t]));

    const blueChips: Asset[] = [];
    const topByMarketCap: Asset[] = [];
    const others: Asset[] = [];

    for (const asset of assets) {
      if (BLUE_CHIP_SYMBOLS.includes(asset.symbol.toUpperCase())) {
        blueChips.push(asset);
        continue;
      }

      const tokenKey = asset.symbol.toLowerCase();
      const token = tokenById.get(tokenKey);

      if (token) {
        topByMarketCap.push(asset);
      } else {
        others.push(asset);
      }
    }

    return { blueChips, topByMarketCap, others };
  }, [assets, tokens]);

  const filteredSections = useMemo((): AssetSections => {
    if (!query.trim()) return sections;

    const q = query.toLowerCase();

    const filterList = (list: Asset[]) =>
      list.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.assetId.toLowerCase().includes(q)
      );

    return {
      blueChips: filterList(sections.blueChips),
      topByMarketCap: filterList(sections.topByMarketCap),
      others: filterList(sections.others),
    };
  }, [sections, query]);

  useEffect(() => {
    if (!query.trim()) return;

    const totalAssets =
      filteredSections.blueChips.length +
      filteredSections.topByMarketCap.length +
      filteredSections.others.length;

    if (totalAssets === 0) {
      logEvent({
        type: "asset_search_no_results",
        direction,
        networkId,
        query,
      });
    }
  }, [filteredSections, query, direction, networkId]);

  const selectedAsset = assets.find((a) => a.assetId === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-white text-sm font-medium">{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              "w-[251px] h-8 justify-between bg-[#252525] border border-[#343434] text-white hover:bg-[#2b2b2b] rounded-[5px] px-3 py-1",
              !selectedAsset && "text-gray-400"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                {selectedAsset?.iconUrl ? (
                  <img 
                    src={selectedAsset.iconUrl} 
                    alt={selectedAsset.symbol}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-[#202027]" />
                )}
              </div>
              <span className="text-[12px] leading-[15px] tracking-[-0.03em] font-medium text-white/90 truncate">
                {loading
                  ? "Loading tokens..."
                  : selectedAsset
                  ? selectedAsset.symbol
                  : "Select asset"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#3A3A3A] rounded-[2px] px-1 py-1">
              <span className="text-[8px] leading-2.5 tracking-[-0.03em] uppercase">
                Asset
              </span>
              <svg width="5" height="9" viewBox="0 0 5 9" className="text-[#B7B7B7]">
                <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1" fill="none"/>
              </svg>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "w-[var(--radix-popover-trigger-width)] p-0",
            "border border-white/5 bg-[#050507]/95 backdrop-blur-sm",
            "rounded-xl shadow-[0_18px_40px_rgba(0,0,0,0.65)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "outline-none"
          )}
        >
          <Command className="bg-transparent">
            <div className="px-3.5 pt-3 pb-2 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">
                  Select Asset
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#101015] border border-white/5 px-2.5 py-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white/35">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" fill="none" strokeWidth="1"/>
                  <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1"/>
                </svg>
                <CommandInput
                  placeholder="Search tokens..."
                  value={query}
                  onValueChange={setQuery}
                  className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/35 focus:outline-none border-0 p-0"
                />
              </div>
            </div>
            <CommandList className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <CommandEmpty className="px-3.5 py-4 text-[12px] text-white/40">
                No assets found.
              </CommandEmpty>

              {filteredSections.blueChips.length > 0 && (
                <CommandGroup className="px-1.5 py-1.5 space-y-0.5">
                  {filteredSections.blueChips.map((asset) => (
                    <CommandItem
                      key={asset.assetId}
                      value={asset.symbol}
                      onSelect={() => {
                        onChange(asset.assetId);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] text-white/80 data-[selected=true]:bg-white/6 data-[selected=true]:text-white hover:bg-white/4 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                        {asset.iconUrl ? (
                          <img 
                            src={asset.iconUrl} 
                            alt={asset.symbol}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#202027]" />
                        )}
                      </div>
                      <span className="truncate">{asset.symbol}</span>
                      {value === asset.assetId && (
                        <span className="ml-auto text-xs text-green-400">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredSections.topByMarketCap.length > 0 && (
                <CommandGroup className="px-1.5 py-1.5 space-y-0.5">
                  {filteredSections.topByMarketCap.map((asset) => (
                    <CommandItem
                      key={asset.assetId}
                      value={asset.symbol}
                      onSelect={() => {
                        onChange(asset.assetId);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] text-white/80 data-[selected=true]:bg-white/6 data-[selected=true]:text-white hover:bg-white/4 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                        {asset.iconUrl ? (
                          <img 
                            src={asset.iconUrl} 
                            alt={asset.symbol}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#202027]" />
                        )}
                      </div>
                      <span className="truncate">{asset.symbol}</span>
                      {value === asset.assetId && (
                        <span className="ml-auto text-xs text-green-400">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredSections.others.length > 0 && (
                <CommandGroup className="px-1.5 py-1.5 space-y-0.5">
                  {filteredSections.others.map((asset) => (
                    <CommandItem
                      key={asset.assetId}
                      value={asset.symbol}
                      onSelect={() => {
                        onChange(asset.assetId);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] text-white/80 data-[selected=true]:bg-white/6 data-[selected=true]:text-white hover:bg-white/4 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                        {asset.iconUrl ? (
                          <img 
                            src={asset.iconUrl} 
                            alt={asset.symbol}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#202027]" />
                        )}
                      </div>
                      <span className="truncate">{asset.symbol}</span>
                      {value === asset.assetId && (
                        <span className="ml-auto text-xs text-green-400">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
