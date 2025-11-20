const GradientBlur = ({ className, opacity = "opacity-30" }: { className: string; opacity?: string }) => (
  <div className={`absolute blur-[60.4px] ${opacity} ${className}`} />
);

export const FooterSection = () => {
  return (
    <footer className="relative w-full bg-[#090909] overflow-hidden py-10 md:py-12 lg:py-[77px]">
      <GradientBlur 
        className="top-[77px] right-[6px] w-[136px] h-[223px] rounded-[68px/111.57px] rotate-[30deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(199,107,107,1)_100%)]" 
        opacity="opacity-[0.63]"
      />
      <GradientBlur 
        className="top-[67px] right-[225px] w-[167px] h-[392px] rounded-[83.66px/196.23px] rotate-[72.79deg] [background:radial-gradient(50%_50%_at_78%_27%,rgba(117,98,228,1)_0%,rgba(189,146,65,1)_100%)]" 
        opacity="opacity-[0.63]"
      />

      <div className="container mx-auto px-4 md:px-8 lg:px-[135px] flex flex-col md:flex-row items-center md:items-center justify-center md:justify-between gap-4 md:gap-6 lg:gap-0">
        <a
          href="#"
          className="font-normal text-white text-xs md:text-sm lg:text-sm tracking-[-0.36px] md:tracking-[-0.42px] leading-[normal] underline hover:no-underline transition-all text-center md:text-left"
        >
          Is there a platform you would like us to add? Let us know!
        </a>

        <div className="font-normal text-[#8b8b8b] text-sm md:text-sm lg:text-base text-center md:text-right tracking-[-0.42px] md:tracking-[-0.42px] lg:tracking-[-0.48px] leading-[normal]">
          © 2025 NEAR Intents
        </div>
      </div>
    </footer>
  );
};
