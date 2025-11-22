import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { z } from 'zod'
import { VolumeChart } from '@/components/dashboard/volume-chart'

const searchSchema = z.object({
  period: z.enum(["7d", "30d", "90d", "all"]).default("all").catch("all"),
})

export type VolumesSearch = z.infer<typeof searchSchema>

export const Route = createFileRoute('/_layout/volumes')({
  validateSearch: searchSchema,
  component: VolumesPage,
  loader: async ({ context }) => {
    const providersQuery = context.orpc.getProviders.queryOptions()
    const providers = await context.queryClient.ensureQueryData(providersQuery)

    const volumeProviders = providers.providers.filter((p) => 
      p.supportedData.includes("volumes")
    )

    if (volumeProviders.length > 0) {
      const volumesQuery = context.orpc.getVolumesAggregated.queryOptions({
        input: {
          period: "all",
          providers: volumeProviders.map((p) => p.id),
        }
      })
      await context.queryClient.ensureQueryData(volumesQuery)
    }

    return { providers }
  },
  pendingComponent: () => (
    <div className="relative w-full min-h-screen flex items-center justify-center">
      <div className="text-white text-lg">Loading volumes...</div>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter()
    const queryErrorResetBoundary = useQueryErrorResetBoundary()

    useEffect(() => {
      queryErrorResetBoundary.reset()
    }, [queryErrorResetBoundary])

    return (
      <div className="relative w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 text-white">Failed to load volumes</h2>
          <p className="mb-4 text-red-400">{error.message}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.invalidate()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  },
})

function VolumesPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { orpc } = Route.useRouteContext()
  const loaderData = Route.useLoaderData()

  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(new Set())

  const providersData = loaderData.providers as any

  const volumeProviders = useMemo(() => 
    (providersData?.providers || []).filter((p: any) => 
      p.supportedData.includes("volumes")
    ), [providersData]
  )

  const selectedPeriod = search.period || "all"

  const volumeQueryOptions = orpc.getVolumesAggregated.queryOptions({
    input: {
      period: selectedPeriod,
      providers: volumeProviders.map((p: any) => p.id as any),
    }
  })

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    ...volumeQueryOptions,
    enabled: volumeProviders.length > 0,
  })

  useEffect(() => {
    if (volumeProviders.length > 0 && visibleProviders.size === 0) {
      setVisibleProviders(new Set(volumeProviders.map((p: any) => p.id)))
    }
  }, [volumeProviders, visibleProviders.size])

  const handleToggleProvider = (id: string) => {
    const newVisible = new Set(visibleProviders)
    if (newVisible.has(id)) {
      newVisible.delete(id)
    } else {
      newVisible.add(id)
    }
    setVisibleProviders(newVisible)
  }

  const handlePeriodChange = (period: string) => {
    navigate({
      search: (prev) => ({ ...prev, period: period as VolumesSearch["period"] })
    })
  }

  return (
    <VolumeChart 
      volumeData={volumeData}
      providersInfo={volumeProviders}
      loading={volumeLoading}
      selectedPeriod={selectedPeriod}
      onPeriodChange={handlePeriodChange}
      visibleProviders={visibleProviders}
      onToggleProvider={handleToggleProvider}
    />
  )
}
