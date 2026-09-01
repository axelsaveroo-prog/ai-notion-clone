import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Floating Logo Header (No frame, no text) */}
      <header className="flex items-center justify-center py-6 mb-4">
        <img 
          src="/Asset 2@1080x.png" 
          alt="Sika Creative Logo" 
          className="h-10 w-auto object-contain select-none" 
        />
      </header>

      {/* Main Workspace Feed */}
      <main className="flex-1 flex flex-col gap-6 pb-20">
        <ForYouKanban />
        <TeamCalendar />
      </main>
    </MobileContainer>
  );
}
