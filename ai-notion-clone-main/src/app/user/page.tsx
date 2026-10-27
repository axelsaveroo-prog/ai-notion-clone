import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";
import { MapPin } from "lucide-react";

export default function UserPage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">User & Operations</h2>
          <p className="text-sm text-gray-400">Manage your account profile and record field attendance.</p>
        </div>

        {/* Authentication Card */}
        <div className="bg-[#161618] border border-[#27272a] p-6 rounded-3xl shadow-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-white mb-1">Account Authentication</h3>
            <p className="text-xs text-gray-400">Sign in with your authorized company profile.</p>
          </div>
          <div>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-zinc-800 text-white border border-zinc-700 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-zinc-700 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>

        {/* Attendance Tracker Card */}
        <div className="bg-[#161618] border border-[#27272a] p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={18} className="text-zinc-400" />
            <h3 className="font-bold text-lg text-white">Live GPS Attendance</h3>
          </div>
          <AttendanceTracker />
        </div>
      </div>
    </MobileContainer>
  );
}
