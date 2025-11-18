"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { client } from "@/utils/orpc";
import type { SnapshotType, TimeWindow } from "@data-provider/shared-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type ProviderId = "across" | "nearIntents";

type BlockchainId = "eth" | "arb";

type RouteConfig = {
  source: {
    blockchain: BlockchainId;
    symbol: string;
    decimals: number;
    contractAddress: string;
    assetId: string;
  };
  destination: {
    blockchain: BlockchainId;
    symbol: string;
    decimals: number;
    contractAddress: string;
    assetId: string;
  };
};

// Provider metadata - extensible for future dropdowns
interface Provider {
  id: ProviderId;
  label: string;
  tag: string;
}

const PROVIDERS: Provider[] = [
  { id: "across", label: "Across Protocol", tag: "Bridge" },
  { id: "nearIntents", label: "NEAR Intents", tag: "Intent-based" },
];

const AVAILABLE_PROVIDERS = PROVIDERS.map((p) => p.id) as ProviderId[];
type SnapshotByProvider = Record<ProviderId, SnapshotType>;

// Combined notionals object (value + label)
const NOTIONALS = [
  { label: "$100", value: "100000000" },
  { label: "$1K", value: "1000000000" },
  { label: "$10K", value: "10000000000" },
  { label: "$100K", value: "100000000000" },
  { label: "$1M", value: "1000000000000" },
] as const;

// Time window constants
const ALL_WINDOWS: TimeWindow[] = ["24h", "7d", "30d"];

// Blockchain options for route configuration
const BLOCKCHAIN_OPTIONS = [
  { value: "eth", label: "Ethereum" },
  { value: "arb", label: "Arbitrum" },
] as const;

// Helper to build assetId from blockchain and contract address
const buildAssetId = (blockchain: string, contractAddress: string) =>
  `nep141:${blockchain}-${contractAddress}.omft.near`;

// Initial route config (matches the original TEST_ROUTES[0])
const INITIAL_ROUTE_CONFIG: RouteConfig = {
  source: {
    blockchain: "eth",
    symbol: "USDC",
    decimals: 6,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    assetId: buildAssetId("eth", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
  },
  destination: {
    blockchain: "arb",
    symbol: "USDC",
    decimals: 6,
    contractAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    assetId: buildAssetId("arb", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
  },
};

export default function Home() {
  const [routeConfig, setRouteConfig] = useState(INITIAL_ROUTE_CONFIG);
  const [selectedNotionalValues, setSelectedNotionalValues] = useState<
    string[]
  >(NOTIONALS.map((n) => n.value));
  const [selectedWindows, setSelectedWindows] =
    useState<TimeWindow[]>(ALL_WINDOWS);
  const [leftProviderId, setLeftProviderId] =
    useState<ProviderId>("nearIntents");
  const [rightProviderId, setRightProviderId] = useState<ProviderId>("across");

  // Derive provider metadata from selection
  const leftProvider = PROVIDERS.find((p) => p.id === leftProviderId)!;
  const rightProvider = PROVIDERS.find((p) => p.id === rightProviderId)!;

  const routes = [routeConfig];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "snapshot",
      {
        providers: AVAILABLE_PROVIDERS,
        routes,
        notionals: selectedNotionalValues,
        includeWindows: selectedWindows,
      },
    ],
    queryFn: () =>
      client.snapshot({
        providers: AVAILABLE_PROVIDERS,
        routes,
        notionals: selectedNotionalValues,
        includeWindows: selectedWindows,
      }),
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // Derive snapshots generically
  const leftSnapshot = data?.[leftProviderId];
  const rightSnapshot = data?.[rightProviderId];

  const handleRefetch = () => {
    refetch();
  };

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            {leftProvider.label} vs {rightProvider.label}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Compare snapshot data between traditional bridge protocols and
            intent-based systems
          </p>
        </div>

        {/* Route Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Route Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-[1fr_auto_1fr] items-end gap-6">
              <div className="space-y-3">
                <Label>Source Blockchain</Label>
                <Select
                  value={routeConfig.source.blockchain}
                  onValueChange={(value: BlockchainId) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      source: {
                        ...prev.source,
                        blockchain: value,
                        assetId: buildAssetId(
                          value,
                          prev.source.contractAddress
                        ),
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKCHAIN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label>Source Asset Symbol</Label>
                <Input
                  value={routeConfig.source.symbol}
                  onChange={(e) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      source: { ...prev.source, symbol: e.target.value },
                    }))
                  }
                />

                <Label>Source Contract Address</Label>
                <Input
                  value={routeConfig.source.contractAddress}
                  onChange={(e) => {
                    const contractAddress = e.target.value;
                    setRouteConfig((prev) => ({
                      ...prev,
                      source: {
                        ...prev.source,
                        contractAddress,
                        assetId: buildAssetId(
                          prev.source.blockchain,
                          contractAddress
                        ),
                      },
                    }));
                  }}
                />
              </div>

              <div className="text-2xl text-center">→</div>

              <div className="space-y-3">
                <Label>Destination Blockchain</Label>
                <Select
                  value={routeConfig.destination.blockchain}
                  onValueChange={(value: BlockchainId) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      destination: {
                        ...prev.destination,
                        blockchain: value,
                        assetId: buildAssetId(
                          value,
                          prev.destination.contractAddress
                        ),
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKCHAIN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label>Destination Asset Symbol</Label>
                <Input
                  value={routeConfig.destination.symbol}
                  onChange={(e) =>
                    setRouteConfig((prev) => ({
                      ...prev,
                      destination: {
                        ...prev.destination,
                        symbol: e.target.value,
                      },
                    }))
                  }
                />

                <Label>Destination Contract Address</Label>
                <Input
                  value={routeConfig.destination.contractAddress}
                  onChange={(e) => {
                    const contractAddress = e.target.value;
                    setRouteConfig((prev) => ({
                      ...prev,
                      destination: {
                        ...prev.destination,
                        contractAddress,
                        assetId: buildAssetId(
                          prev.destination.blockchain,
                          contractAddress
                        ),
                      },
                    }));
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Selection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Left Provider</Label>
                <Select value={leftProviderId} disabled>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Right Provider</Label>
                <Select
                  value={rightProviderId}
                  onValueChange={(value: ProviderId) =>
                    setRightProviderId(value)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.filter((p) => p.id !== leftProviderId).map(
                      (provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Comparison Controls</h2>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Include Notionals:</label>
            {NOTIONALS.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedNotionalValues.includes(value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedNotionalValues([
                        ...selectedNotionalValues,
                        value,
                      ]);
                    } else {
                      setSelectedNotionalValues(
                        selectedNotionalValues.filter((v) => v !== value)
                      );
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Time Windows:</label>
            {ALL_WINDOWS.map((window) => (
              <label key={window} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedWindows.includes(window)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedWindows([...selectedWindows, window]);
                    } else {
                      setSelectedWindows(
                        selectedWindows.filter((w) => w !== window)
                      );
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{window}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleRefetch}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Refresh Comparison"}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 bg-destructive/15 border border-destructive rounded-lg">
            <p className="text-destructive">
              Error loading data: {(error as Error).message}
            </p>
          </div>
        )}

        {/* Summary Cards */}
        {(leftSnapshot || rightSnapshot) && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Provider Card */}
            <div className="p-6 bg-card border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{leftProvider.label}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {leftProvider.tag}
                </span>
              </div>

              {leftSnapshot?.volumes && (
                <div className="space-y-2 mb-4">
                  <span className="text-sm text-muted-foreground">
                    Volumes:
                  </span>
                  {leftSnapshot.volumes.map((vol: any) => (
                    <div key={vol.window} className="text-sm">
                      {vol.window}: $
                      {Math.round(vol.volumeUsd).toLocaleString()}
                    </div>
                  ))}
                </div>
              )}

              {leftSnapshot?.listedAssets && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Assets: </span>
                  {leftSnapshot.listedAssets.assets.length}
                </div>
              )}

              {leftSnapshot?.rates && (
                <div className="text-sm text-green-600">
                  ✓ Rates available ({leftSnapshot.rates.length} quotes)
                </div>
              )}

              {leftSnapshot?.liquidity && (
                <div className="text-sm text-green-600">
                  ✓ Liquidity depth available
                </div>
              )}
            </div>

            {/* Right Provider Card */}
            <div className="p-6 bg-card border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">{rightProvider.label}</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  {rightProvider.tag}
                </span>
              </div>

              {rightSnapshot?.volumes && (
                <div className="space-y-2 mb-4">
                  <span className="text-sm text-muted-foreground">
                    Volumes:
                  </span>
                  {rightSnapshot.volumes.map((vol: any) => (
                    <div key={vol.window} className="text-sm">
                      {vol.window}: $
                      {Math.round(vol.volumeUsd).toLocaleString()}
                    </div>
                  ))}
                </div>
              )}

              {rightSnapshot?.listedAssets && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Assets: </span>
                  {rightSnapshot.listedAssets.assets.length}
                </div>
              )}

              {rightSnapshot?.rates && (
                <div className="text-sm text-green-600">
                  ✓ Rates available ({rightSnapshot.rates.length} quotes)
                </div>
              )}

              {rightSnapshot?.liquidity && (
                <div className="text-sm text-green-600">
                  ✓ Liquidity depth available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rates Comparison */}
        {(leftSnapshot?.rates || rightSnapshot?.rates) &&
          selectedNotionalValues.length > 0 && (
            <div className="p-6 bg-card border rounded-lg">
              <h2 className="text-xl font-semibold mb-6">Rate Comparison</h2>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Notional</th>
                      <th className="text-center py-2 px-3 col-span-3">
                        {leftProvider.label}
                      </th>
                      <th className="text-center py-2 px-3 col-span-3">
                        {rightProvider.label}
                      </th>
                    </tr>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th></th>
                      <th className="py-1 px-3">Amount Out</th>
                      <th className="py-1 px-3">Rate</th>
                      <th className="py-1 px-3">Fees</th>
                      <th className="py-1 px-3">Amount Out</th>
                      <th className="py-1 px-3">Rate</th>
                      <th className="py-1 px-3">Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIONALS.filter((n) =>
                      selectedNotionalValues.includes(n.value)
                    ).map(({ label, value }) => {
                      const leftRate = leftSnapshot?.rates?.find(
                        (r) => r.amountIn === value
                      );
                      const rightRate = rightSnapshot?.rates?.find(
                        (r) => r.amountIn === value
                      );

                      return (
                        <tr key={value} className="border-b">
                          <td className="py-3 px-3 font-medium">{label}</td>
                          <td className="py-3 px-3 text-center">
                            {leftRate
                              ? `${(
                                  Number(leftRate.amountOut) /
                                  (leftProviderId === "across" ? 1e18 : 1e6)
                                ).toFixed(6)}`
                              : "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {leftRate?.effectiveRate?.toFixed(6) || "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {leftRate?.totalFeesUsd !== null
                              ? `$${leftRate?.totalFeesUsd?.toFixed(2)}`
                              : "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {rightRate
                              ? `${(
                                  Number(rightRate.amountOut) /
                                  (rightProviderId === "across" ? 1e18 : 1e6)
                                ).toFixed(6)}`
                              : "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {rightRate?.effectiveRate?.toFixed(6) || "-"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {rightRate?.totalFeesUsd !== null
                              ? `$${rightRate?.totalFeesUsd?.toFixed(2)}`
                              : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* Liquidity Comparison */}
        {(leftSnapshot?.liquidity || rightSnapshot?.liquidity) && (
          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-xl font-semibold mb-6">
              Liquidity Depth (USDC → USDC)
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              {[50, 100].map((bps) => (
                <div key={bps} className="space-y-3">
                  <h3 className="font-medium">{bps} bps slippage threshold</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">{leftProvider.label}:</span>
                      <span className="text-sm font-mono">
                        {leftSnapshot?.liquidity?.[0]?.thresholds?.find(
                          (t) => t.slippageBps === bps
                        )
                          ? `${Math.round(
                              Number(
                                leftSnapshot.liquidity[0].thresholds.find(
                                  (t) => t.slippageBps === bps
                                )?.maxAmountIn
                              ) / (leftProviderId === "across" ? 1e18 : 1e6)
                            ).toLocaleString()} USDC`
                          : "No data"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">{rightProvider.label}:</span>
                      <span className="text-sm font-mono">
                        {rightSnapshot?.liquidity?.[0]?.thresholds?.find(
                          (t) => t.slippageBps === bps
                        )
                          ? `${Math.round(
                              Number(
                                rightSnapshot.liquidity[0].thresholds.find(
                                  (t) => t.slippageBps === bps
                                )?.maxAmountIn
                              ) / (rightProviderId === "across" ? 1e18 : 1e6)
                            ).toLocaleString()} USDC`
                          : "No data"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asset Coverage */}
        {leftSnapshot?.listedAssets && rightSnapshot?.listedAssets && (
          <div className="p-6 bg-card border rounded-lg">
            <h2 className="text-xl font-semibold mb-6">Asset Coverage</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-medium mb-2">
                  Only in {leftProvider.label}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {leftSnapshot.listedAssets.assets
                    .filter(
                      (a) =>
                        !rightSnapshot.listedAssets.assets.some(
                          (b) => b.symbol === a.symbol
                        )
                    )
                    .slice(0, 10)
                    .map((asset) => (
                      <span
                        key={asset.assetId}
                        className="px-2 py-1 bg-gray-100 text-xs rounded"
                      >
                        {asset.symbol}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Shared Assets</h3>
                <div className="flex flex-wrap gap-1">
                  {leftSnapshot.listedAssets.assets
                    .filter((a) =>
                      rightSnapshot.listedAssets.assets.some(
                        (b) => b.symbol === a.symbol
                      )
                    )
                    .slice(0, 10)
                    .map((asset) => (
                      <span
                        key={asset.assetId}
                        className="px-2 py-1 bg-blue-100 text-xs rounded"
                      >
                        {asset.symbol}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">
                  Only in {rightProvider.label}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {rightSnapshot.listedAssets.assets
                    .filter(
                      (b) =>
                        !leftSnapshot.listedAssets.assets.some(
                          (a) => a.symbol === b.symbol
                        )
                    )
                    .slice(0, 10)
                    .map((asset) => (
                      <span
                        key={asset.assetId}
                        className="px-2 py-1 bg-green-100 text-xs rounded"
                      >
                        {asset.symbol}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
