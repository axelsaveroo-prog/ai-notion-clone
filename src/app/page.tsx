import { AICommandBar } from "@/components/AICommandBar";
import { AttendanceTracker } from "@/components/AttendanceTracker";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0b0b0c] text-gray-100 flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-[#1f1f22] bg-[#121214]/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚡</span>
          <h1 className="font-bold text-sm tracking-tight text-white">Notion OS</h1>
        </div>
        <div className="text-[10px] sm:text-xs text-orange-400 font-medium bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
          Connected
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">Workspace Overview</h2>
          <p className="text-xs sm:text-sm text-gray-400">Manage your tasks and track live attendance with custom AI intelligence.</p>
        </div>

        {/* Reference-inspired Dark Cards */}
        <div className="grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2">
          
          {/* Highlight / Primary Orange Card (Inspired by reference active state) */}
          <div className="bg-[#f97316] text-black p-5 sm:p-6 rounded-2xl shadow-lg relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider bg-black/10 px-2.5 py-1 rounded-md">Command Center</span>
                <span className="text-lg">✨</span>
              </div>
              <h3 className="font-bold text-lg mb-1">AI Assistant</h3>
              <p className="text-xs text-black/80 mb-4">Run workspace commands instantly using plain text prompts.</p>
            </div>
            <div className="bg-black/5 p-3 rounded-xl backdrop-blur-sm border border-black/10">
              <AICommandBar />
            </div>
          </div>

          {/* Standard Dark Charcoal Card */}
          <div className="bg-[#161618] border border-[#27272a] p-5 sm:p-6 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 bg-[#222226] px-2.5 py-1 rounded-md">Field Operations</span>
                <span className="text-lg">📍</span>
              </div>
              <h3 className="font-bold text-lg text-white mb-1">Live Attendance</h3>
              <p className="text-xs text-gray-400 mb-4">Verify location coordinates and record time-logs safely.</p>
            </div>
            <div className="bg-[#121214] p-3 rounded-xl border border-[#27272a]">
              <AttendanceTracker />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
