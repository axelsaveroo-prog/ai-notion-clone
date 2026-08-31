import { AICommandBar } from "@/components/AICommandBar";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Top Header */}
      <header className="border-b border-[#1f1f22] bg-[#121214]/80 backdrop-blur-md px-4 sm:px-6 py-3.5 rounded-2xl flex items-center justify-between sticky top-4 z-10 mb-6 shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">Sika Creative OS</h1>
        </div>
        <div className="text-xs text-orange-400 font-medium bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Connected
        </div>
      </header>

      {/* Main Content Workspace Stack */}
      <main className="flex-1 flex flex-col gap-6 pb-12">
        
        {/* 1. FOR YOU: Kanban Tasks */}
        <ForYouKanban />

        {/* 2. CALENDARS: Team Google Calendar Schedule */}
        <TeamCalendar />

        {/* 3. AI Command Center */}
        <div className="bg-[#f97316] text-black p-6 rounded-2xl shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider bg-black/10 px-3 py-1 rounded-md">Command Center</span>
          <h3 className="font-bold text-xl mt-2">AI Assistant</h3>
          <p className="text-xs text-black/80 mb-4">Run workspace commands instantly.</p>
          <div className="bg-black/5 p-3 rounded-xl border border-black/10">
            <AICommandBar />
          </div>
        </div>

        {/* 4. Field Attendance Tracker */}
        <div className="bg-[#161618] border border-[#27272a] p-6 rounded-2xl shadow-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#222226] px-3 py-1 rounded-md">Operations</span>
          <h3 className="font-bold text-xl text-white mt-2">Live Attendance</h3>
          <p className="text-xs text-gray-400 mb-4">Verify GPS coordinates safely.</p>
          <div className="bg-[#121214] p-3 rounded-xl border border-[#27272a]">
            <AttendanceTracker />
          </div>
        </div>

      </main>
    </MobileContainer>
  );
}
