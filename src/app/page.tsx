import { AICommandBar } from "@/components/AICommandBar";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Top Header with Integrated AI Search Pill */}
      <header className="border-b border-[#1f1f22] bg-[#121214]/80 backdrop-blur-md px-4 py-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-4 z-10 mb-6 shadow-md">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚡</span>
            <h1 className="font-bold text-sm tracking-tight text-white">Sika Creative OS</h1>
          </div>
          <div className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20 sm:hidden flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            Connected
          </div>
        </div>

        {/* AI Command Pill in Header */}
        <div className="w-full sm:w-72">
          <AICommandBar />
        </div>
      </header>

      {/* Main Workspace Feed */}
      <main className="flex-1 flex flex-col gap-6 pb-16">
        <ForYouKanban />
        <TeamCalendar />
      </main>
    </MobileContainer>
  );
}
