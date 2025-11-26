import { ComparisonTable } from "@/components/dashboard/comparison-table";
import { MetricsTable } from "@/components/dashboard/metrics-table";
import { SwapPairSelector } from "@/components/dashboard/swap-pair-selector";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import {
  createFileRoute,
  useRouter
} from "@tanstack/react-router";
import { Suspense, useEffect, useMemo } from "react";
import { z } from "zod";
import { useAtom } from "@effect-atom/atom-react";
import {
  sourceAssetAtom,
  destAssetAtom,
  selectedProviderAtom,
  compareEnabledAtom,
} from "@/store/swap";

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
  const loaderData = Route.useLoaderData();
  
  const [sourceAsset] = useAtom(sourceAssetAtom);
  const [destAsset] = useAtom(destAssetAtom);
  const [selectedProvider, setSelectedProvider] = useAtom(selectedProviderAtom);
  const [compareEnabled, setCompareEnabled] = useAtom(compareEnabledAtom);

  const providersData = loaderData.providers;

  const assetProviders = useMemo(
    () =>
      (providersData?.providers || []).filter(
        (p: any) =>
          p.id !== "near_intents" && p.supportedData?.includes("assets")
      ),
    [providersData]
  );

  useEffect(() => {
    const defaultProvider = search.provider || (assetProviders.length > 0 ? assetProviders[0].id : "");
    if (defaultProvider !== selectedProvider) {
      setSelectedProvider(defaultProvider);
    }
  }, [search.provider, assetProviders, selectedProvider, setSelectedProvider]);

  useEffect(() => {
    if (search.source !== sourceAsset?.assetId || search.destination !== destAsset?.assetId) {
      setCompareEnabled(false);
    }
  }, [search.source, search.destination, sourceAsset?.assetId, destAsset?.assetId, setCompareEnabled]);

  return (
    <div className="w-full h-full space-y-4 md:space-y-6">
      <section className="relative w-full pt-6 md:pt-8 pb-4 md:pb-6">
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
        <ComparisonTable />
      </Suspense>
      
      <Suspense fallback={<SwapPairSelectorSkeleton />}>
        <SwapPairSelector />
      </Suspense>
      
      {compareEnabled && (
        <Suspense fallback={<MetricsTableSkeleton />}>
          <MetricsTable />
        </Suspense>
      )}
    </div>
  );
}

function ComparisonTableSkeleton() {
  return (
    <section className="relative w-full py-4 md:py-6">
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
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
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
    <section className="relative w-full py-4 md:py-6">
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
