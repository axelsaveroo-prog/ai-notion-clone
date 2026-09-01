"use client";

import { useState } from "react";
import { MapPin, ShieldCheck } from "lucide-react";

export function AttendanceTracker() {
  const [status, setStatus] = useState<"out" | "in">("out");
  const [lastTime, setLastTime] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 text-xs bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between border-b border-[#222226] pb-3 text-white font-medium">
        <span>Live GPS Attendance</span>
        <span className="text-[10px] bg-[#1a1a1e] text-gray-300 px-2.5 py-0.5 rounded border border-[#222226]">Secure Shift</span>
      </div>

      <div className="flex items-center justify-between bg-[#161618] p-3 rounded-xl border border-[#222226] text-gray-300">
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
          <span>Semarang, Central Java (GPS Verified)</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#161618] p-4 rounded-xl border border-[#222226]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === "in" ? "bg-white animate-pulse" : "bg-gray-600"}`}></span>
            <span className="font-medium text-white">
              Status: {status === "in" ? "Checked In (On Shift)" : "Checked Out"}
            </span>
          </div>
          {lastTime && (
            <span className="text-[11px] text-gray-400">Last action recorded at {lastTime}</span>
          )}
        </div>

        <div>
          {status === "out" ? (
            <button
              onClick={() => { setStatus("in"); setLastTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); }}
              className="bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
            >
              Check In
            </button>
          ) : (
            <button
              onClick={() => { setStatus("out"); setLastTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); }}
              className="bg-[#1a1a1e] text-gray-300 hover:text-white border border-[#222226] font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Check Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
