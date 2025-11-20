import { createFileRoute } from '@tanstack/react-router'
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
  return (
    <div className="relative w-full min-h-screen bg-[#090909] overflow-hidden">
      <GradientBlur className="top-[-214px] left-[1111px] w-[244px] h-[401px] rounded-[122.14px/200.39px] rotate-[-62.18deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
      <GradientBlur className="top-[50px] left-[1233px] w-[301px] h-[705px] rounded-[150.26px/352.45px] rotate-[-19.39deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />
      
      <VolumeChartSection />
      <ComparisonTableSection />
      <MetricsTableSection />
      <FooterSection />
    </div>
  )
}
