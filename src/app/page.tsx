import { AICommandBar } from "@/components/AICommandBar";
import { AttendanceTracker } from "@/components/AttendanceTracker";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#37352f] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-200 bg-white px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📓</span>
          <h1 className="font-semibold text-sm tracking-tight">Notion OS Workspace</h1>
        </div>
        <div className="text-xs text-gray-400 font-medium">Workspace Active • Neon DB Connected</div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[#37352f] mb-1">Getting Started</h2>
          <p className="text-sm text-gray-500">Manage your workspace tasks and track live attendance with AI commands.</p>
        </div>

        {/* Notion-style Card Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">✨ AI Command Center</h3>
            <AICommandBar />
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">📍 Attendance & Location</h3>
            <AttendanceTracker />
          </div>
        </div>
      </main>
    </div>
  );
}
