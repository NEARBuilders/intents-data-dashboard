import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/utils/orpc'
import { useState, useMemo, useEffect } from 'react'
import { VolumeChart } from '@/components/dashboard/volume-chart'
import { ComparisonTable } from '@/components/dashboard/comparison-table'
import { MetricsTable } from '@/components/dashboard/metrics-table'
import { Footer } from '@/components/footer'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
)

function LandingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("ALL")
  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(new Set())
  const [selectedProvider, setSelectedProvider] = useState("")

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => client.getProviders(),
    refetchOnWindowFocus: false,
  })

  const volumeProviders = useMemo(() => 
    (providersData?.providers || []).filter((p: any) => 
      p.supportedData.includes("volumes")
    ), [providersData]
  )

  const assetProviders = useMemo(() => 
    (providersData?.providers || []).filter((p: any) => 
      p.id !== "near_intents" && p.supportedData?.includes("assets")
    ), [providersData]
  )

  useEffect(() => {
    if (assetProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(assetProviders[0].id)
    }
  }, [assetProviders, selectedProvider])

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ["volumes-aggregated", selectedPeriod.toLowerCase(), volumeProviders.map((p: any) => p.id)],
    queryFn: () => client.getVolumesAggregated({
      period: selectedPeriod.toLowerCase() as "7d" | "30d" | "90d" | "all",
      providers: volumeProviders.map((p: any) => p.id as any),
    }),
    enabled: volumeProviders.length > 0,
    refetchOnWindowFocus: false,
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

  return (
    <div className="relative w-full min-h-screen bg-[#090909] overflow-hidden">
      <GradientBlur className="top-[-214px] left-[1111px] w-[244px] h-[401px] rounded-[122.14px/200.39px] rotate-[-62.18deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
      <GradientBlur className="top-[50px] left-[1233px] w-[301px] h-[705px] rounded-[150.26px/352.45px] rotate-[-19.39deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />
      
      <VolumeChart 
        volumeData={volumeData}
        providersInfo={volumeProviders}
        loading={volumeLoading || providersLoading}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        visibleProviders={visibleProviders}
        onToggleProvider={handleToggleProvider}
      />
      <ComparisonTable 
        selectedProvider={selectedProvider}
        onProviderChange={setSelectedProvider}
        providersInfo={providersData?.providers || []}
        loading={providersLoading}
      />
      <MetricsTable 
        selectedProvider={selectedProvider}
        providersInfo={providersData?.providers || []}
        loading={providersLoading}
      />
      <Footer />
    </div>
  )
}
