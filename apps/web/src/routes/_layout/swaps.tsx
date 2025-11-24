import { ComparisonTable } from "@/components/dashboard/comparison-table";
import { MetricsTable } from "@/components/dashboard/metrics-table";
import { SwapPairSelector } from "@/components/dashboard/swap-pair-selector";
import { useAggregatorAssets } from "@/lib/aggregator/hooks";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  createFileRoute,
  useRouter
} from "@tanstack/react-router";
import { Suspense, useEffect, useMemo } from "react";
import { z } from "zod";

const searchSchema = z
  .object({
    source: z.string().optional(),
    destination: z.string().optional(),
    provider: z.string().optional(),
  })
  .catch({});

export type SwapsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_layout/swaps")({
  validateSearch: searchSchema,
  component: SwapsPage,
  loader: async ({ context }) => {
    const providersQuery = context.orpc.getProviders.queryOptions();
    const providers = await context.queryClient.ensureQueryData(providersQuery);
    return { providers: providers };
  },
  pendingComponent: () => (
    <div className="relative w-full min-h-screen flex items-center justify-center">
      <div className="text-white text-lg">Loading swap comparison...</div>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const queryErrorResetBoundary = useQueryErrorResetBoundary();

    useEffect(() => {
      queryErrorResetBoundary.reset();
    }, [queryErrorResetBoundary]);

    return (
      <div className="relative w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 text-white">
            Failed to load swap data
          </h2>
          <p className="mb-4 text-red-400">{error.message}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.invalidate()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
});

function SwapsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const loaderData = Route.useLoaderData();

  const providersData = loaderData.providers;
  const { uniqueAssets } = useAggregatorAssets();

  const assetProviders = useMemo(
    () =>
      (providersData?.providers || []).filter(
        (p: any) =>
          p.id !== "near_intents" && p.supportedData?.includes("assets")
      ),
    [providersData]
  );

  const selectedProvider =
    search.provider || (assetProviders.length > 0 ? assetProviders[0].id : "");

  const sourceAsset = useMemo(
    () => uniqueAssets.find((a) => a.assetId === search.source) ?? null,
    [uniqueAssets, search.source]
  );

  const destAsset = useMemo(
    () => uniqueAssets.find((a) => a.assetId === search.destination) ?? null,
    [uniqueAssets, search.destination]
  );

  const selectedRoute = useMemo(() => {
    if (!sourceAsset || !destAsset) return null;

    return {
      source: sourceAsset,
      destination: destAsset,
    };
  }, [sourceAsset, destAsset]);

  const handleProviderChange = (provider: string) => {
    navigate({
      search: (prev) => ({ ...prev, provider }),
    });
  };

  return (
    <div className="w-full h-full">
      <section className="relative w-full  pt-12">
        <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            Head to Head Comparisons
          </h1>
          <p className="text-base md:text-lg text-gray-300">
            Select a cross-chain swap platform to compare with NEAR Intents.
          </p>
        </div>
      </section>

      <Suspense fallback={<ComparisonTableSkeleton />}>
        <ComparisonTable
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          providersInfo={providersData?.providers || []}
          selectedRoute={selectedRoute}
        />
      </Suspense>
      
      <Suspense fallback={<SwapPairSelectorSkeleton />}>
        <SwapPairSelector />
      </Suspense>
      
      <Suspense fallback={<MetricsTableSkeleton />}>
        <MetricsTable
          selectedProvider={selectedProvider}
          providersInfo={providersData?.providers || []}
          selectedRoute={selectedRoute}
        />
      </Suspense>
    </div>
  );
}

function ComparisonTableSkeleton() {
  return (
    <section className="relative w-full py-10 md:py-12 lg:py-16">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-8">
          <div className="h-64 flex items-center justify-center">
            <span className="text-white text-sm">Loading comparison...</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SwapPairSelectorSkeleton() {
  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
      <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-6">
        <div className="h-32 flex items-center justify-center">
          <span className="text-white text-sm">Loading swap selector...</span>
        </div>
      </div>
    </div>
  );
}

function MetricsTableSkeleton() {
  return (
    <section className="relative w-full bg-[#090909] py-10 md:py-12 lg:py-16">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-8">
          <div className="h-64 flex items-center justify-center">
            <span className="text-white text-sm">Loading metrics...</span>
          </div>
        </div>
      </div>
    </section>
  );
}
