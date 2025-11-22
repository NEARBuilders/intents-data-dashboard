import { ComparisonTable } from "@/components/dashboard/comparison-table";
import { MetricsTable } from "@/components/dashboard/metrics-table";
import { SwapPairSelector } from "@/components/dashboard/swap-pair-selector";
import { parse1csToAsset } from "@/lib/1cs-utils";
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

  const selectedRoute = useMemo(() => {
    if (search.source && search.destination) {
      const sourcePartial = parse1csToAsset(search.source);
      const destPartial = parse1csToAsset(search.destination);

      if (sourcePartial && destPartial) {
        return {
          source: {
            blockchain: sourcePartial.blockchain!,
            assetId: sourcePartial.assetId!,
            symbol: "",
            contractAddress: sourcePartial.contractAddress,
          },
          destination: {
            blockchain: destPartial.blockchain!,
            assetId: destPartial.assetId!,
            symbol: "",
            contractAddress: destPartial.contractAddress,
          },
        };
      }
    }
    return null;
  }, [search.source, search.destination]);

  const handleProviderChange = (provider: string) => {
    navigate({
      search: (prev) => ({ ...prev, provider }),
    });
  };

  return (
    <>
      <Suspense fallback={<SwapPairSelectorSkeleton />}>
        <SwapPairSelector />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <ComparisonTable
          selectedProvider={selectedProvider}
          onProviderChange={handleProviderChange}
          providersInfo={providersData?.providers || []}
          selectedRoute={selectedRoute}
        />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <MetricsTable
          selectedProvider={selectedProvider}
          providersInfo={providersData?.providers || []}
          selectedRoute={selectedRoute}
        />
      </Suspense>
    </>
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

function TableSkeleton() {
  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] mb-8">
      <div className="bg-[#0e0e0e] border border-[#343434] rounded-[14px] p-6">
        <div className="h-64 flex items-center justify-center">
          <span className="text-white text-sm">Loading data...</span>
        </div>
      </div>
    </div>
  );
}
