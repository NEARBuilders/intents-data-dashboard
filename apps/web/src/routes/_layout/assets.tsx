import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListedAssets } from "@/hooks/use-listed-assets";
import { buildSymbolGroups } from "@/lib/symbol-groups";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";

const searchSchema = z.object({
  search: z.string().optional().default(""),
  provider: z.string().optional().default("all"),
  blockchain: z.string().optional().default("all"),
});

export type AssetsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_layout/assets")({
  validateSearch: searchSchema,
  component: AssetsPage,
  loader: async ({ context }) => {
    const providersQuery = context.orpc.getProviders.queryOptions();
    const providers = await context.queryClient.ensureQueryData(providersQuery);
    return { providers: providers };
  },
  pendingComponent: () => (
    <div className="relative w-full min-h-screen flex items-center justify-center">
      <div className="text-white text-lg">Loading assets...</div>
    </div>
  ),
});

function AssetsPage() {
  const loaderData = Route.useLoaderData();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const search = urlSearch.search || "";
  const selectedProvider = urlSearch.provider || "all";
  const selectedBlockchain = urlSearch.blockchain || "all";

  const handleSearchChange = (value: string) => {
    navigate({
      search: (prev) => ({ ...prev, search: value || undefined }),
    });
  };

  const handleProviderChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        provider: value === "all" ? undefined : value,
      }),
    });
  };

  const handleBlockchainChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        blockchain: value === "all" ? undefined : value,
      }),
    });
  };

  const assetProviders = useMemo(
    () =>
      (loaderData.providers?.providers || []).filter((p) =>
        p.supportedData?.includes("assets")
      ),
    [loaderData.providers]
  );

  const { data: assetsData, isLoading: assetsLoading } = useListedAssets();

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const symbolGroups = useMemo(() => {
    if (!assetsData) return [];
    return buildSymbolGroups(assetsData);
  }, [assetsData]);

  const filteredSymbols = useMemo(() => {
    return symbolGroups.filter((group) => {
      const matchesSearch =
        !search ||
        group.symbol.toLowerCase().includes(search.toLowerCase()) ||
        group.allBlockchains.some((b) =>
          b.toLowerCase().includes(search.toLowerCase())
        );

      const matchesProvider =
        selectedProvider === "all" ||
        group.allProviders.includes(selectedProvider);

      const matchesBlockchain =
        selectedBlockchain === "all" ||
        group.allBlockchains.includes(selectedBlockchain);

      return matchesSearch && matchesProvider && matchesBlockchain;
    });
  }, [symbolGroups, search, selectedProvider, selectedBlockchain]);

  const blockchains = useMemo(() => {
    const chains = new Set<string>();
    for (const group of symbolGroups) {
      group.allBlockchains.forEach((b) => chains.add(b));
    }
    return Array.from(chains).sort();
  }, [symbolGroups]);

  const selectedGroup = useMemo(() => {
    return filteredSymbols.find((g) => g.symbol === selectedSymbol) || null;
  }, [filteredSymbols, selectedSymbol]);

  if (assetsLoading) {
    return (
      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] py-12">
        <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-8">
          <div className="text-center">
            <p className="text-gray-400 text-lg">Loading assets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Asset Explorer</h1>
        <p className="text-gray-400 text-lg">
          Browse and compare cross-chain assets supported by different providers
        </p>
      </header>

      {selectedGroup && (
        <Card className="mb-6 bg-[#0e0e0e] border-[#343434] rounded-[14px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                  {selectedGroup.iconUrl ? (
                    <img
                      src={selectedGroup.iconUrl}
                      alt={selectedGroup.symbol}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-[#202027]" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {selectedGroup.symbol}
                  </h2>
                  {selectedGroup.price && (
                    <p className="text-gray-400">
                      $
                      {selectedGroup.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedSymbol(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">
                Provider Support
              </h3>
              {selectedGroup.allProviders.map((providerId) => {
                const provider = assetProviders.find((p) => p.id === providerId);
                const supportedBlockchains = selectedGroup.allBlockchains.filter(
                  (blockchain) => selectedGroup.providers[providerId]?.[blockchain]
                );

                return (
                  <div
                    key={providerId}
                    className="bg-[#1a1a1a] border border-[#343434] rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium text-lg">
                        {provider?.label || providerId}
                      </h4>
                      <span className="text-gray-400 text-sm">
                        {supportedBlockchains.length}{" "}
                        {supportedBlockchains.length === 1 ? "network" : "networks"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {supportedBlockchains.map((blockchain) => (
                        <span
                          key={blockchain}
                          className="px-3 py-1.5 rounded-md text-sm font-medium bg-[#252525] text-white border border-[#343434] capitalize"
                        >
                          {blockchain}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by symbol, asset ID, or blockchain..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 bg-[#252525] border-[#343434] text-white placeholder:text-gray-500"
        />

        <Select
          value={selectedBlockchain}
          onValueChange={handleBlockchainChange}
        >
          <SelectTrigger className="w-full sm:w-[200px] bg-[#252525] border-[#343434] text-white">
            <SelectValue placeholder="All Blockchains" />
          </SelectTrigger>
          <SelectContent className="bg-[#242424] border-[#343434]">
            <SelectItem value="all" className="text-white">
              All Blockchains
            </SelectItem>
            {blockchains.map((chain) => (
              <SelectItem key={chain} value={chain} className="text-white">
                {chain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-full sm:w-[200px] bg-[#252525] border-[#343434] text-white">
            <SelectValue placeholder="All Providers" />
          </SelectTrigger>
          <SelectContent className="bg-[#242424] border-[#343434]">
            <SelectItem value="all" className="text-white">
              All Providers
            </SelectItem>
            {assetProviders.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                className="text-white"
              >
                {provider.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#0e0e0e] border-[#343434] rounded-[14px]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#343434]">
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Symbol
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Price
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Blockchains
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Providers
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSymbols.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-400">
                      No assets found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredSymbols.map((group) => (
                    <tr
                      key={group.symbol}
                      className={cn(
                        "border-b border-[#343434] hover:bg-[#1a1a1a] transition-colors cursor-pointer",
                        selectedSymbol === group.symbol && "bg-[#1a1a1a]"
                      )}
                      onClick={() =>
                        setSelectedSymbol(
                          selectedSymbol === group.symbol ? null : group.symbol
                        )
                      }
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                            {group.iconUrl ? (
                              <img
                                src={group.iconUrl}
                                alt={group.symbol}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-[#202027]" />
                            )}
                          </div>
                          <div className="text-white font-medium">
                            {group.symbol}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {group.price ? (
                          <span className="text-white">
                            $
                            {group.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {group.allBlockchains.map((blockchain) => (
                            <span
                              key={blockchain}
                              className="px-2 py-1 rounded text-xs font-medium bg-[#252525] text-white border border-[#343434] capitalize"
                            >
                              {blockchain}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {group.allProviders.map((providerId) => {
                            const provider = assetProviders.find(
                              (p) => p.id === providerId
                            );
                            return (
                              <span
                                key={providerId}
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  "bg-[#252525] text-white border border-[#343434]"
                                )}
                              >
                                {provider?.label || providerId}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 text-gray-400 text-sm">
        Showing {filteredSymbols.length} of {symbolGroups.length} symbols
      </div>
    </div>
  );
}
