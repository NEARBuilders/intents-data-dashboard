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
import type { CoinGeckoPlatform } from "@/lib/coingecko/types";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const PINNED_NETWORK_IDS = [
  "ethereum",
  "bitcoin",
  "near-protocol",
  "sui",
  "zcash",
  "base",
  "avalanche",
  "polygon-pos",
  "binance-smart-chain",
  "arbitrum-one",
  "optimistic-ethereum",
  "solana",
  "fantom",
];

interface NetworkSelectProps {
  label: string;
  value?: string;
  onChange: (networkId: string) => void;
  platforms?: CoinGeckoPlatform[];
  disabled?: boolean;
}

export const NetworkSelect = ({
  label,
  value,
  onChange,
  platforms,
  disabled,
}: NetworkSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sortedPlatforms = useMemo(() => {
    if (!platforms) return { pinned: [], remaining: [] };

    const byId = new Map(platforms.map((p) => [p.id, p]));

    const pinned = PINNED_NETWORK_IDS.map((id) => byId.get(id)).filter(
      (p): p is CoinGeckoPlatform => !!p
    );

    const remaining = platforms
      .filter((p) => !PINNED_NETWORK_IDS.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { pinned, remaining };
  }, [platforms]);

  const filteredPlatforms = useMemo(() => {
    if (!query.trim()) return sortedPlatforms;

    const q = query.toLowerCase();
    const filter = (list: CoinGeckoPlatform[]) =>
      list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.shortname?.toLowerCase().includes(q)
      );

    return {
      pinned: filter(sortedPlatforms.pinned),
      remaining: filter(sortedPlatforms.remaining),
    };
  }, [sortedPlatforms, query]);

  const selectedPlatform = platforms?.find((p) => p.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-white text-sm font-medium">{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-[251px] h-8 justify-between bg-[#252525] border border-[#343434] text-white hover:bg-[#2b2b2b] rounded-[5px] px-3 py-1",
              !selectedPlatform && "text-gray-400"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                {selectedPlatform?.image?.thumb ? (
                  <img 
                    src={selectedPlatform.image.thumb} 
                    alt={selectedPlatform.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-[#202027]" />
                )}
              </div>
              <span className="text-[12px] leading-[15px] tracking-[-0.03em] font-medium text-white/90 truncate">
                {selectedPlatform ? selectedPlatform.name : "Select blockchain"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#3A3A3A] rounded-[2px] px-1 py-1">
              <span className="text-[8px] leading-[10px] tracking-[-0.03em] uppercase">
                Blockchain
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
                  Select Blockchain
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#101015] border border-white/5 px-2.5 py-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white/35">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" fill="none" strokeWidth="1"/>
                  <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1"/>
                </svg>
                <CommandInput
                  placeholder="Search blockchains..."
                  value={query}
                  onValueChange={setQuery}
                  className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/35 focus:outline-none border-0 p-0"
                />
              </div>
            </div>
            <CommandList className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <CommandEmpty className="px-3.5 py-4 text-[12px] text-white/40">
                No blockchains found.
              </CommandEmpty>

              {filteredPlatforms.pinned.length > 0 && (
                <CommandGroup className="px-1.5 py-1.5 space-y-0.5">
                  {filteredPlatforms.pinned.map((platform) => (
                    <CommandItem
                      key={platform.id}
                      value={`${platform.name} ${platform.id} ${platform.shortname || ''}`}
                      onSelect={() => {
                        onChange(platform.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] text-white/80 data-[selected=true]:bg-white/6 data-[selected=true]:text-white hover:bg-white/4 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                        {platform.image?.thumb ? (
                          <img 
                            src={platform.image.thumb} 
                            alt={platform.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#202027]" />
                        )}
                      </div>
                      <span className="truncate">{platform.name}</span>
                      {value === platform.id && (
                        <span className="ml-auto text-xs text-green-400">✓</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredPlatforms.remaining.length > 0 && (
                <CommandGroup className="px-1.5 py-1.5 space-y-0.5">
                  {filteredPlatforms.remaining.map((platform) => (
                    <CommandItem
                      key={platform.id}
                      value={`${platform.name} ${platform.id} ${platform.shortname || ''}`}
                      onSelect={() => {
                        onChange(platform.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-[12px] text-white/80 data-[selected=true]:bg-white/6 data-[selected=true]:text-white hover:bg-white/4 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                        {platform.image?.thumb ? (
                          <img 
                            src={platform.image.thumb} 
                            alt={platform.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full bg-[#202027]" />
                        )}
                      </div>
                      <span className="truncate">{platform.name}</span>
                      {value === platform.id && (
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
