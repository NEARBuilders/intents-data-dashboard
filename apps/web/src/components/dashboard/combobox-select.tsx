import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

interface ComboboxSelectProps<T> {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  items: T[];
  loading?: boolean;
  disabled?: boolean;
  
  getItemValue: (item: T) => string;
  getItemDisplay: (item: T) => string;
  getItemIcon?: (item: T) => string | undefined;
  getSearchText: (item: T) => string;
  
  tagLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  
  pinnedValues?: string[];
  onSearchNoResults?: (query: string) => void;
}

export function ComboboxSelect<T>({
  label,
  value,
  onChange,
  items,
  loading,
  disabled,
  getItemValue,
  getItemDisplay,
  getItemIcon,
  getSearchText,
  tagLabel,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  pinnedValues = [],
  onSearchNoResults,
}: ComboboxSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { pinned, remaining } = useMemo(() => {
    if (pinnedValues.length === 0) {
      return { pinned: items, remaining: [] as T[] };
    }

    const byValue = new Map(items.map((item) => [getItemValue(item), item]));
    
    const pinnedItems = pinnedValues
      .map((val) => byValue.get(val))
      .filter((item): item is T => !!item);
    
    const remainingItems = items
      .filter((item) => !pinnedValues.includes(getItemValue(item)))
      .sort((a, b) => getItemDisplay(a).localeCompare(getItemDisplay(b)));
    
    return { pinned: pinnedItems, remaining: remainingItems };
  }, [items, pinnedValues, getItemValue, getItemDisplay]);

  const filtered = useMemo(() => {
    if (!query.trim()) return { pinned, remaining };

    const q = query.toLowerCase();
    const filter = (list: T[]) =>
      list.filter((item) => getSearchText(item).toLowerCase().includes(q));

    const filteredPinned = filter(pinned);
    const filteredRemaining = filter(remaining);

    if (filteredPinned.length === 0 && filteredRemaining.length === 0 && onSearchNoResults) {
      onSearchNoResults(query);
    }

    return { pinned: filteredPinned, remaining: filteredRemaining };
  }, [pinned, remaining, query, getSearchText, onSearchNoResults]);

  const selectedItem = items.find((item) => getItemValue(item) === value);

  return (
    <div className="flex flex-col gap-2 w-full md:w-auto">
      {label && <Label className="text-white text-sm font-medium">{label}</Label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full md:w-[280px] lg:w-[320px] h-auto justify-between bg-[#252525] border border-[#343434] text-white hover:bg-[#2b2b2b] rounded-[5px] px-4 py-2.5 md:py-3",
              !selectedItem && "text-gray-400"
            )}
          >
            <div className="flex items-center gap-2">
              {loading ? (
                <>
                  <div className="h-6 w-6 md:h-5 md:w-5 rounded-full bg-[#202027] animate-pulse" />
                  <span className="text-base md:text-sm leading-[15px] tracking-[-0.03em] font-semibold text-white/50 truncate">
                    Loading...
                  </span>
                </>
              ) : (
                <>
                  <div className="h-6 w-6 md:h-5 md:w-5 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                    {selectedItem && getItemIcon?.(selectedItem) ? (
                      <img
                        src={getItemIcon(selectedItem)}
                        alt={getItemDisplay(selectedItem)}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-[#202027]" />
                    )}
                  </div>
                  <span className="text-base md:text-sm leading-[15px] tracking-[-0.03em] font-semibold text-white truncate">
                    {selectedItem ? getItemDisplay(selectedItem) : placeholder}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-[#3A3A3A] rounded-[2px] px-2 py-1.5 md:px-1.5 md:py-1">
              <span className="text-[8px] leading-[10px] tracking-[-0.03em] uppercase">
                {tagLabel}
              </span>
              <svg width="5" height="9" viewBox="0 0 5 9" className="text-[#B7B7B7]">
                <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1" fill="none" />
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
            "border border-[#343434] bg-[#252525] backdrop-blur-sm",
            "rounded-xl shadow-[0_18px_40px_rgba(0,0,0,0.65)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "outline-none"
          )}
        >
          <Command className="bg-transparent">
            <div className="px-4 pt-4 pb-3 border-b border-[#343434]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm uppercase tracking-[0.14em] text-white/60">
                  Select {tagLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#1a1a1a] border border-[#343434] px-3 py-2">
                <svg width="14" height="14" viewBox="0 0 16 16" className="h-4 w-4 text-white/35">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" fill="none" strokeWidth="1" />
                  <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" strokeWidth="1" />
                </svg>
                <CommandInput
                  placeholder={searchPlaceholder}
                  value={query}
                  onValueChange={setQuery}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none border-0 p-0"
                />
              </div>
            </div>
            <CommandList className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <CommandEmpty className="px-4 py-5 text-sm text-white/40">
                {emptyMessage}
              </CommandEmpty>

              {filtered.pinned.length > 0 && (
                <CommandGroup className="px-2 py-2 space-y-1">
                  {filtered.pinned.map((item) => {
                    const itemValue = getItemValue(item);
                    return (
                      <CommandItem
                        key={itemValue}
                        value={getSearchText(item)}
                        onSelect={() => {
                          onChange(itemValue);
                          setOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-[#2b2b2b] data-[selected=true]:text-white hover:bg-[#2b2b2b] transition-colors"
                      >
                        <div className="h-6 w-6 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                          {getItemIcon?.(item) ? (
                            <img
                              src={getItemIcon(item)}
                              alt={getItemDisplay(item)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-[#202027]" />
                          )}
                        </div>
                        <span className="truncate flex-1">{getItemDisplay(item)}</span>
                        {value === itemValue && (
                          <span className="ml-auto text-sm text-green-400">✓</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {filtered.remaining.length > 0 && (
                <CommandGroup className="px-2 py-2 space-y-1">
                  {filtered.remaining.map((item) => {
                    const itemValue = getItemValue(item);
                    return (
                      <CommandItem
                        key={itemValue}
                        value={getSearchText(item)}
                        onSelect={() => {
                          onChange(itemValue);
                          setOpen(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-[#2b2b2b] data-[selected=true]:text-white hover:bg-[#2b2b2b] transition-colors"
                      >
                        <div className="h-6 w-6 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                          {getItemIcon?.(item) ? (
                            <img
                              src={getItemIcon(item)}
                              alt={getItemDisplay(item)}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-[#202027]" />
                          )}
                        </div>
                        <span className="truncate flex-1">{getItemDisplay(item)}</span>
                        {value === itemValue && (
                          <span className="ml-auto text-sm text-green-400">✓</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
