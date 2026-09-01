"use client";

import { useState } from "react";
import { MapPin, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

export function AttendanceTracker() {
  const [status, setStatus] = useState<"out" | "in">("out");
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("Semarang, Central Java (GPS Verified)");

  const handleCheckIn = () => {
    setStatus("in");
    setLastTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleCheckOut = () => {
    setStatus("out");
    setLastTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center justify-between bg-[#161618] p-3 rounded-xl border border-[#222226]">
        <div className="flex items-center gap-2.5 text-gray-300">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{locationText}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-[#121214] px-2.5 py-1 rounded-md border border-[#222226]">
          <ShieldCheck className="w-3 h-3 text-white" />
          <span>Secure Shift</span>
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

        <div className="flex items-center gap-2">
          {status === "out" ? (
            <button
              onClick={handleCheckIn}
              className="bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
            >
              Check In
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
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
