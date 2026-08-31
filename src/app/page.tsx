import { AICommandBar } from "@/components/AICommandBar";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  return (
    <MobileContainer>
      {/* Top Header */}
      <header className="border-b border-[#1f1f22] bg-[#121214]/80 backdrop-blur-md px-4 sm:px-6 py-3.5 rounded-2xl flex items-center justify-between sticky top-4 z-10 mb-8 shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">Notion OS Workspace</h1>
        </div>
        <div className="text-xs text-orange-400 font-medium bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Connected
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col gap-6">
        <div className="mb-2">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">Workspace Dashboard</h2>
          <p className="text-sm text-gray-400">Manage tasks and track live attendance smoothly on any device.</p>
        </div>

        {/* Responsive Grid: 1 column on mobile, 2 columns on desktop */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          
          {/* AI Command Center Card (Vibrant Orange Accent) */}
          <div className="bg-[#f97316] text-black p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col justify-between">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider bg-black/10 px-3 py-1 rounded-md text-black">Command Center</span>
              <h3 className="font-bold text-2xl mt-3 text-black">AI Assistant</h3>
              <p className="text-xs sm:text-sm text-black/80 mt-1">Run workspace operations instantly using natural language prompts.</p>
            </div>
            <div className="bg-black/5 p-4 rounded-2xl backdrop-blur-sm border border-black/10">
              <AICommandBar />
            </div>
          </div>

          {/* Attendance Tracker Card (Dark Charcoal) */}
          <div className="bg-[#161618] border border-[#27272a] p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col justify-between">
            <div className="mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#222226] px-3 py-1 rounded-md">Field Operations</span>
              <h3 className="font-bold text-2xl text-white mt-3">Live Attendance</h3>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Verify real-time GPS coordinates and record time logs safely.</p>
            </div>
            <div className="bg-[#121214] p-4 rounded-2xl border border-[#27272a]">
              <AttendanceTracker />
            </div>
          </div>

        </div>
      </main>
    </MobileContainer>
  );
}
