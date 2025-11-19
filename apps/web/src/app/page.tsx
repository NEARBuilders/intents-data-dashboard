"use client";

import { client } from "@/utils/orpc";
import type { TimeWindow } from "@data-provider/shared-contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { ConfigBar } from "@/components/dashboard/config-bar";
import { ProviderComparison } from "@/components/dashboard/provider-comparison";

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

const NOTIONALS = [
  { label: "$100", value: "100000000" },
  { label: "$1K", value: "1000000000" },
  { label: "$10K", value: "10000000000" },
  { label: "$100K", value: "100000000000" },
  { label: "$1M", value: "1000000000000" },
] as const;

const ALL_WINDOWS: TimeWindow[] = ["24h", "7d", "30d", "cumulative"];

const buildAssetId = (blockchain: string, contractAddress: string) =>
  `nep141:${blockchain}-${contractAddress}.omft.near`;

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
  const [selectedNotionalValues, setSelectedNotionalValues] = useState<string[]>(
    NOTIONALS.map((n) => n.value)
  );
  const [selectedWindows, setSelectedWindows] = useState<TimeWindow[]>(ALL_WINDOWS);
  const [leftProviderId] = useState<ProviderId>("nearIntents");
  const [rightProviderId, setRightProviderId] = useState<ProviderId>("across");

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
    staleTime: 30000,
  });

  const leftSnapshot = data?.[leftProviderId];
  const rightSnapshot = data?.[rightProviderId];

  const providerLabels = {
    [leftProviderId]: leftProvider.label,
    [rightProviderId]: rightProvider.label,
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-destructive/15 border border-destructive rounded-lg">
            <p className="text-destructive text-sm">
              Error loading data: {(error as Error).message}
            </p>
          </div>
        )}

        <ConfigBar
          routeConfig={routeConfig}
          onRouteChange={setRouteConfig}
          selectedNotionals={selectedNotionalValues}
          onNotionalsChange={setSelectedNotionalValues}
          selectedWindows={selectedWindows}
          onWindowsChange={setSelectedWindows}
          notionals={NOTIONALS.map((n) => ({ label: n.label, value: n.value }))}
          windows={ALL_WINDOWS}
          rightProviderId={rightProviderId}
          onRightProviderChange={setRightProviderId}
          availableProviders={PROVIDERS.filter((p) => p.id !== leftProviderId)}
          isLoading={isLoading}
          onRefresh={refetch}
        />

        <VolumeChart snapshots={data || {}} providerLabels={providerLabels} />

        <ProviderComparison
          leftProvider={leftProvider}
          rightProvider={rightProvider}
          leftSnapshot={leftSnapshot}
          rightSnapshot={rightSnapshot}
          selectedNotionals={selectedNotionalValues}
          notionals={NOTIONALS.map((n) => ({ label: n.label, value: n.value }))}
        />
      </div>
    </div>
  );
}
