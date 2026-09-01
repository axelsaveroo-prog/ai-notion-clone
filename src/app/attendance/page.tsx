"use client";

import { useState, useEffect } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";
import { Shield, UserCheck, Cpu, Terminal, FileText, Save, Check } from "lucide-react";

export default function UserPage() {
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cachedMemo = localStorage.getItem("sika_studio_memo");
    if (cachedMemo) setMemo(cachedMemo);
  }, []);

  const handleSaveMemo = () => {
    localStorage.setItem("sika_studio_memo", memo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-24">
        
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">User & Executive Command</h2>
          <p className="text-xs text-gray-400">High-level telemetry, field attendance, and studio scratchpad.</p>
        </div>

        {/* 1. Studio Profile & Authentication Card */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#222226] pb-3">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <UserCheck className="w-4 h-4 text-gray-400" />
              <span>Operator Profile</span>
            </div>
            <span className="text-[10px] bg-[#1a1a1e] text-gray-300 px-2.5 py-0.5 rounded border border-[#222226] font-medium">
              Root Clearance
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">Sika Creative OS Principal</span>
              <span className="text-xs text-gray-400">Internal Workspace Engine v2.6</span>
            </div>
            <div>
              <SignedOut>
                {/* Fixed Clerk Sign In button */}
                <SignInButton mode="modal">
                  <button className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition-colors shadow-sm cursor-pointer">
                    Sign In to Sika
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2 bg-[#161618] px-3 py-1.5 rounded-xl border border-[#222226]">
                  <span className="text-xs text-gray-300">Active</span>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>

        {/* 2. Field GPS Attendance */}
        <AttendanceTracker />

        {/* 3. Studio Quick Scratchpad */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#222226] pb-3">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <FileText className="w-4 h-4 text-gray-400" />
              <span>Studio Scratchpad & Memos</span>
            </div>
            <button
              onClick={handleSaveMemo}
              className="text-[10px] bg-[#1a1a1e] hover:bg-white hover:text-black text-gray-300 px-3 py-1 rounded-lg border border-[#222226] font-medium transition-colors flex items-center gap-1 cursor-pointer"
            >
              {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {saved ? "Saved" : "Save Memo"}
            </button>
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Type confidential notes, prompt ideas, or client reminders here..."
            className="w-full h-28 bg-[#161618] border border-[#222226] rounded-xl p-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500 resize-none font-sans"
          />
        </div>

        {/* 4. System Telemetry & Diagnostics */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-white font-medium text-xs border-b border-[#222226] pb-3">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span>Workspace Telemetry</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 pt-1">
            <div className="bg-[#161618] p-3 rounded-xl border border-[#222226]">
              <span className="block text-[10px] text-gray-500 uppercase">Framework</span>
              <span className="text-white font-medium">Next.js App Router</span>
            </div>
            <div className="bg-[#161618] p-3 rounded-xl border border-[#222226]">
              <span className="block text-[10px] text-gray-500 uppercase">Aesthetic</span>
              <span className="text-white font-medium">Liveblocks Monochrome</span>
            </div>
          </div>
        </div>

      </div>
    </MobileContainer>
  );
}
