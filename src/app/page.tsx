import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Centered Small Logo & Branding Header */}
      <header className="flex flex-col items-center justify-center py-8 mb-6 gap-3">
        <div className="w-14 h-14 rounded-full bg-[#161618] border-2 border-[#27272a] flex items-center justify-center overflow-hidden shadow-xl">
          <img 
            src="/Asset 2@1080x.png" 
            alt="Sika Creative Logo" 
            className="w-full h-full object-cover" 
          />
        </div>
        <div className="text-center">
          <h1 className="font-bold text-lg text-white tracking-tight">SIKA APPS</h1>
          <p className="text-xs text-orange-400 font-medium">Internal Creative Factory</p>
        </div>
      </header>

      {/* Main Workspace Feed */}
      <main className="flex-1 flex flex-col gap-6 pb-20">
        <ForYouKanban />
        <TeamCalendar />
      </main>
    </MobileContainer>
  );
}
