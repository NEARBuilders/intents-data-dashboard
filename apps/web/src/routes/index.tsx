import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { client } from '@/utils/orpc'
import { useState, useMemo, useEffect } from 'react'
import { VolumeChartSection } from '@/screens/LandingPage/sections/VolumeChartSection'
import { ComparisonTableSection } from '@/screens/LandingPage/sections/ComparisonTableSection'
import { MetricsTableSection } from '@/screens/LandingPage/sections/MetricsTableSection'
import { FooterSection } from '@/screens/LandingPage/sections/FooterSection'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
)

function LandingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("ALL")
  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(new Set())

  const dateRange = useMemo(() => {
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    
    if (selectedPeriod === "7D") {
      const start = new Date(today)
      start.setDate(start.getDate() - 7)
      return { startDate: formatDate(start), endDate: formatDate(today) }
    }
    if (selectedPeriod === "30D") {
      const start = new Date(today)
      start.setDate(start.getDate() - 30)
      return { startDate: formatDate(start), endDate: formatDate(today) }
    }
    if (selectedPeriod === "90D") {
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { startDate: formatDate(start), endDate: formatDate(today) }
    }
    return { startDate: undefined, endDate: undefined }
  }, [selectedPeriod])

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => client.getProviders(),
    refetchOnWindowFocus: false,
  })

  const volumeProviders = useMemo(() => 
    (providersData?.providers || []).filter(p => 
      p.supportedData.includes("volumes")
    ), [providersData]
  )

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ["volumes", volumeProviders.map(p => p.id), dateRange],
    queryFn: () => client.getVolumes({
      providers: volumeProviders.map(p => p.id as any),
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    }),
    enabled: volumeProviders.length > 0,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (volumeProviders.length > 0 && visibleProviders.size === 0) {
      setVisibleProviders(new Set(volumeProviders.map(p => p.id)))
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
      
      <VolumeChartSection 
        volumeData={volumeData}
        providersInfo={volumeProviders}
        loading={volumeLoading || providersLoading}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        visibleProviders={visibleProviders}
        onToggleProvider={handleToggleProvider}
      />
      <ComparisonTableSection 
        providersInfo={providersData?.providers || []}
        loading={providersLoading}
      />
      <MetricsTableSection />
      <FooterSection />
    </div>
  )
}
