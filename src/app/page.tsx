import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Header Photo Banner */}
      <div className="w-full h-32 sm:h-40 rounded-3xl overflow-hidden relative mb-4 border border-[#27272a] shadow-lg">
        <img
          src="/SIKA LOGOS WHITE.png"
          alt="Header Cover"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0c] via-transparent to-transparent"></div>
      </div>

     {/* Company Box with Circular Logo Frame */}
      <div className="bg-[#161618] border border-[#27272a] p-4 sm:p-5 rounded-3xl flex items-center justify-between mb-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#222226] flex items-center justify-center border-2 border-[#27272a] shrink-0 overflow-hidden shadow-md">
            <img 
              src="/BANNER.png" 
              alt="Company Logo" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight">Official Sika Apps</h1>
            <p className="text-xs text-orange-400 font-medium">Pabrik Dalam</p>
          </div>
        </div>
        
        <div className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
          Live
        </div>
      </div>

      {/* Main Workspace Feed */}
      <main className="flex-1 flex flex-col gap-6 pb-20">
        <ForYouKanban />
        <TeamCalendar />
      </main>
    </MobileContainer>
  );
}
