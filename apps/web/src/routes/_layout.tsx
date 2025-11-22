import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

const GradientBlur = ({ className, opacity = "opacity-30" }: { className: string; opacity?: string }) => (
  <div className={`absolute blur-[60.4px] ${opacity} ${className}`} />
);

function LayoutComponent() {
  return (
    <div className="relative flex flex-col w-full min-h-screen bg-[#090909] overflow-hidden">
      <GradientBlur className="top-[-214px] left-[1111px] w-[244px] h-[401px] rounded-[122.14px/200.39px] rotate-[-62.18deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
      <GradientBlur className="top-[50px] left-[1233px] w-[301px] h-[705px] rounded-[150.26px/352.45px] rotate-[-19.39deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />

      <nav className="relative z-10 w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px] py-6">
        <div className="flex items-center gap-8">
          <Link
            to="/volumes"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: "text-white" }}
          >
            Volumes
          </Link>
          <Link
            to="/swaps"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: "text-white" }}
          >
            Swaps
          </Link>
          <Link
            to="/assets"
            className="text-white/70 hover:text-white transition-colors font-medium"
            activeProps={{ className: "text-white" }}
          >
            Assets
          </Link>
        </div>
      </nav>

      <main className="relative z-10 flex-1 w-full">
        <Outlet />
        <GradientBlur className="top-[461px] left-[-85px] w-52 h-[376px] rounded-[104.12px/187.83px] rotate-[146.01deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" />
        <GradientBlur className="top-[155px] left-[-213px] w-[330px] h-[445px] rounded-[165.07px/222.48px] rotate-[175.81deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" />
      </main>

      <footer className="relative w-full overflow-hidden py-10 md:py-12 lg:py-[77px]">
        <GradientBlur 
          className="top-[77px] right-[6px] w-[136px] h-[223px] rounded-[68px/111.57px] rotate-[30deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" 
          opacity="opacity-[0.63]"
        />
        <GradientBlur 
          className="top-[67px] right-[225px] w-[167px] h-[392px] rounded-[83.66px/196.23px] rotate-[72.79deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" 
          opacity="opacity-[0.63]"
        />

        <div className="container mx-auto px-4 md:px-8 lg:px-[135px] flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 md:gap-6 lg:gap-0">
          <a
            href="#"
            className="text-white text-xs md:text-sm tracking-[-0.36px] md:tracking-[-0.42px] underline hover:no-underline transition-all text-center md:text-left"
          >
            Is there a platform you would like us to add? Let us know!
          </a>

          <div className="text-[#8b8b8b] text-sm lg:text-base text-center md:text-right tracking-[-0.42px] lg:tracking-[-0.48px]">
            © 2025 NEAR Intents
          </div>
        </div>
      </footer>
    </div>
  );
}
