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
import { useStaticAssets } from "@/hooks/use-static-assets";
import { parse1csToAsset } from "@/lib/1cs-utils";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_layout/assets")({
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

interface AssetRow {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  providers: string[];
  iconUrl?: string;
  price?: number;
}

function AssetsPage() {
  const loaderData = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedBlockchain, setSelectedBlockchain] = useState<string>("all");

  const assetProviders = useMemo(
    () =>
      (loaderData.providers?.providers || []).filter((p) =>
        p.supportedData?.includes("assets")
      ),
    [loaderData.providers]
  );

  const providerIds = useMemo(
    () => assetProviders.map((p) => p.id),
    [assetProviders]
  );

  const { data: assetsData, isLoading: assetsLoading } =
    useListedAssets(providerIds);
  const { data: staticAssets } = useStaticAssets();

  const assetRows = useMemo((): AssetRow[] => {
    if (!assetsData) return [];

    const assetMap = new Map<string, AssetRow>();

    for (const [providerId, assets] of Object.entries(assetsData.data)) {
      for (const asset of assets) {
        const parsed = parse1csToAsset(asset.assetId);
        const blockchain = parsed?.blockchain ?? "unknown";

        if (!assetMap.has(asset.assetId)) {
          const cgAsset = staticAssets?.assets.find(
            (a) => a.symbol.toLowerCase() === asset.symbol.toLowerCase()
          );

          assetMap.set(asset.assetId, {
            assetId: asset.assetId,
            symbol: asset.symbol,
            blockchain,
            decimals: asset.decimals,
            providers: [providerId],
            iconUrl: cgAsset?.image,
            price: cgAsset?.current_price,
          });
        } else {
          const existing = assetMap.get(asset.assetId)!;
          if (!existing.providers.includes(providerId)) {
            existing.providers.push(providerId);
          }
        }
      }
    }

    return Array.from(assetMap.values());
  }, [assetsData, staticAssets]);

  const filteredRows = useMemo(() => {
    return assetRows.filter((row) => {
      const matchesSearch =
        !search ||
        row.symbol.toLowerCase().includes(search.toLowerCase()) ||
        row.assetId.toLowerCase().includes(search.toLowerCase()) ||
        row.blockchain.toLowerCase().includes(search.toLowerCase());

      const matchesProvider =
        selectedProvider === "all" ||
        row.providers.includes(selectedProvider);

      const matchesBlockchain =
        selectedBlockchain === "all" || row.blockchain === selectedBlockchain;

      return matchesSearch && matchesProvider && matchesBlockchain;
    });
  }, [assetRows, search, selectedProvider, selectedBlockchain]);

  const blockchains = useMemo(() => {
    const chains = new Set(assetRows.map((r) => r.blockchain));
    return Array.from(chains).sort();
  }, [assetRows]);

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

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by symbol, asset ID, or blockchain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-[#252525] border-[#343434] text-white placeholder:text-gray-500"
        />

        <Select value={selectedBlockchain} onValueChange={setSelectedBlockchain}>
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

        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-full sm:w-[200px] bg-[#252525] border-[#343434] text-white">
            <SelectValue placeholder="All Providers" />
          </SelectTrigger>
          <SelectContent className="bg-[#242424] border-[#343434]">
            <SelectItem value="all" className="text-white">
              All Providers
            </SelectItem>
            {assetProviders.map((provider) => (
              <SelectItem key={provider.id} value={provider.id} className="text-white">
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
                    Asset
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Blockchain
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Price
                  </th>
                  <th className="text-left p-4 text-gray-400 font-medium text-sm">
                    Providers
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-400">
                      No assets found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.assetId}
                      className="border-b border-[#343434] hover:bg-[#1a1a1a] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-b from-[#2b2b31] to-[#111118] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-black/70 overflow-hidden flex-shrink-0">
                            {row.iconUrl ? (
                              <img
                                src={row.iconUrl}
                                alt={row.symbol}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-[#202027]" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {row.symbol}
                            </div>
                            <div className="text-gray-500 text-xs font-mono">
                              {row.assetId.slice(0, 20)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-white capitalize">
                          {row.blockchain}
                        </span>
                      </td>
                      <td className="p-4">
                        {row.price ? (
                          <span className="text-white">
                            ${row.price.toLocaleString(undefined, {
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
                          {row.providers.map((providerId) => {
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
        Showing {filteredRows.length} of {assetRows.length} assets
      </div>
    </div>
  );
}
