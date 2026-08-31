import { AttendanceTracker } from "@/components/AttendanceTracker";
import { MobileContainer } from "@/components/MobileContainer";

export default function AttendancePage() {
  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">Field Attendance</h2>
          <p className="text-sm text-gray-400">Verify your GPS location and log your shift securely.</p>
        </div>

        <div className="bg-[#161618] border border-[#27272a] p-6 rounded-3xl shadow-xl">
          <AttendanceTracker />
        </div>
      </div>
    </MobileContainer>
  );
}
