import { AICommandBar } from "@/components/AICommandBar";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      <div className="min-h-full text-gray-100 flex flex-col selection:bg-orange-500 selection:text-white pb-10">
        {/* Top Header */}
        <header className="border-b border-[#1f1f22] bg-[#121214]/80 backdrop-blur-md px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <h1 className="font-bold text-sm tracking-tight text-white">Notion OS Mobile</h1>
          </div>
          <div className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            Connected
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 px-4 py-6 flex flex-col gap-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white mb-1">Workspace</h2>
            <p className="text-xs text-gray-400">Manage tasks & track attendance on the go.</p>
          </div>

          {/* Card 1: AI Command Center (Highlighted Orange in Dark Theme) */}
          <div className="bg-[#f97316] text-black p-5 rounded-2xl shadow-lg flex flex-col justify-between">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 px-2.5 py-1 rounded-md">Command Center</span>
              <h3 className="font-bold text-lg mt-2">AI Assistant</h3>
              <p className="text-xs text-black/80">Run workspace commands instantly.</p>
            </div>
            <div className="bg-black/5 p-3 rounded-xl backdrop-blur-sm border border-black/10">
              <AICommandBar />
            </div>
          </div>

          {/* Card 2: Attendance Tracker */}
          <div className="bg-[#161618] border border-[#27272a] p-5 rounded-2xl shadow-lg flex flex-col justify-between">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-[#222226] px-2.5 py-1 rounded-md">Operations</span>
              <h3 className="font-bold text-lg text-white mt-2">Live Attendance</h3>
              <p className="text-xs text-gray-400">Verify GPS coordinates safely.</p>
            </div>
            <div className="bg-[#121214] p-3 rounded-xl border border-[#27272a]">
              <AttendanceTracker />
            </div>
          </div>
        </main>
      </div>
    </MobileContainer>
  );
}
