"use client";

import { client } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function Home() {
  const [selectedProviderId, setSelectedProviderId] = useState<string>("near_intents");

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => client.getProviders(),
    refetchOnWindowFocus: false,
  });

  const { data: volumeData, isLoading: volumeLoading, error: volumeError } = useQuery({
    queryKey: ["volumes", selectedProviderId],
    queryFn: () => client.getVolumes({ providers: [selectedProviderId as any] }),
    enabled: !!selectedProviderId,
    refetchOnWindowFocus: false,
  });

  const providers = (providersData?.providers || []).filter(
    (provider) => provider.supportedData.includes("volumes")
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Intents Data Dashboard</h1>
          <p className="text-muted-foreground">
            Query volume data from bridge providers.{" "}
            <a 
              href="https://intents.everything.dev/api" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View API docs →
            </a>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium mb-2">
              Select Provider
            </label>
            {providersLoading ? (
              <div className="text-sm text-muted-foreground">Loading providers...</div>
            ) : (
              <select
                id="provider"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
              >
                <option value="">-- Choose a provider --</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label} ({provider.category})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedProviderId && (
            <div className="border rounded-lg p-4 space-y-4">
              <h2 className="text-xl font-semibold">
                Volume Data for {providers.find(p => p.id === selectedProviderId)?.label}
              </h2>
              
              {volumeLoading && (
                <div className="text-sm text-muted-foreground">Loading volume data...</div>
              )}

              {volumeError && (
                <div className="p-4 bg-destructive/15 border border-destructive rounded-lg">
                  <p className="text-destructive text-sm">
                    Error: {(volumeError as Error).message}
                  </p>
                </div>
              )}

              {volumeData && !volumeLoading && (
                <div className="space-y-3">
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Successfully fetched volume data
                    </p>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Providers:</span>{" "}
                      {volumeData.providers.join(", ")}
                    </div>
                    <div>
                      <span className="font-medium">Measured at:</span>{" "}
                      {new Date(volumeData.measuredAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Data points:</span>{" "}
                      {Object.keys(volumeData.data).length} provider(s)
                    </div>
                  </div>

                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium mb-2">View raw response</summary>
                    <pre className="bg-muted p-3 rounded-md overflow-auto text-xs">
                      {JSON.stringify(volumeData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>
            This dashboard queries the{" "}
            <code className="bg-muted px-1 py-0.5 rounded">/providers</code> and{" "}
            <code className="bg-muted px-1 py-0.5 rounded">/volumes</code> endpoints
            from the aggregator plugin.
          </p>
        </div>
      </div>
    </div>
  );
}
