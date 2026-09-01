import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";
import { Shield, UserCheck, Briefcase, Cpu } from "lucide-react";

export default function UserPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-24">
        
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">User & Studio Operations</h2>
          <p className="text-xs text-gray-400">Manage your credentials, system identity, and field presence.</p>
        </div>

        {/* 1. Identity & Account Card */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#222226] pb-3">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <UserCheck className="w-4 h-4 text-gray-400" />
              <span>Studio Profile & Access</span>
            </div>
            <span className="text-[10px] bg-[#1a1a1e] text-gray-300 px-2.5 py-0.5 rounded border border-[#222226]">
              Level 1 Admin
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">Sika Creative OS Operator</span>
              <span className="text-xs text-gray-400">Internal Company Portal</span>
            </div>
            <div>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition-colors shadow-sm">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-2 bg-[#161618] px-3 py-1.5 rounded-xl border border-[#222226]">
                  <span className="text-xs text-gray-300">Active Session</span>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>

        {/* 2. Live GPS Attendance Card (Sleek Dark Mode) */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white font-medium text-xs border-b border-[#222226] pb-3">
            <Shield className="w-4 h-4 text-gray-400" />
            <span>Field GPS Attendance</span>
          </div>
          <AttendanceTracker />
        </div>

        {/* 3. System Specs / Studio Info Card */}
        <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 text-white font-medium text-xs border-b border-[#222226] pb-3">
            <Cpu className="w-4 h-4 text-gray-400" />
            <span>Environment Diagnostics</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 pt-1">
            <div className="bg-[#161618] p-3 rounded-xl border border-[#222226]">
              <span className="block text-[10px] text-gray-500 uppercase">Architecture</span>
              <span className="text-white font-medium">Next.js App Router</span>
            </div>
            <div className="bg-[#161618] p-3 rounded-xl border border-[#222226]">
              <span className="block text-[10px] text-gray-500 uppercase">Deployment</span>
              <span className="text-white font-medium">Vercel Edge</span>
            </div>
          </div>
        </div>

      </div>
    </MobileContainer>
  );
}
