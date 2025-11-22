import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { Footer } from '@/components/footer'

export const Route = createFileRoute('/_layout')({
  component: LayoutComponent,
})

const GradientBlur = ({ className }: { className: string }) => (
  <div className={`absolute blur-[60.4px] opacity-30 ${className}`} />
)

function LayoutComponent() {
  return (
    <div className="relative w-full min-h-screen bg-[#090909] overflow-hidden">
      <GradientBlur className="top-[-214px] left-[1111px] w-[244px] h-[401px] rounded-[122.14px/200.39px] rotate-[-62.18deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
      <GradientBlur className="top-[50px] left-[1233px] w-[301px] h-[705px] rounded-[150.26px/352.45px] rotate-[-19.39deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />
      
      <nav className="relative z-10 w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] py-6">
        <div className="flex items-center gap-8">
          <Link
            to="/volumes"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: 'text-white' }}
          >
            Volumes
          </Link>
          <Link
            to="/swaps"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: 'text-white' }}
          >
            Swaps
          </Link>
          <Link
            to="/assets"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: 'text-white' }}
          >
            Assets
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        <Outlet />
      </main>
      
      <Footer />
    </div>
  )
}
