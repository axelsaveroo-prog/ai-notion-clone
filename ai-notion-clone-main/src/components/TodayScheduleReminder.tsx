"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Clock, 
  Video, 
  FileText, 
  Users, 
  Sparkles,
  ExternalLink
} from "lucide-react";

interface ScheduleEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  assignees?: string[];
  assignee?: string;
  meetLink?: string;
}

export function TodayScheduleReminder() {
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    // Ambil tanggal lokal hari ini dalam format YYYY-MM-DD
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const saved = localStorage.getItem("SIKA_CALENDAR_EVENTS");
    if (saved) {
      try {
        const events: ScheduleEvent[] = JSON.parse(saved);
        const filtered = events.filter((ev) => ev.date === todayStr);
        setTodayEvents(filtered);
      } catch {
        setTodayEvents([]);
      }
    }
  }, []);

  // Jika tidak ada agenda di hari ini, komponen tidak merender apa-apa
  if (todayEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {todayEvents.map((ev) => {
        const assigneesList = ev.assignees || (ev.assignee ? [ev.assignee] : ["Team"]);
        const meetUrl = ev.meetLink || "https://meet.google.com/new";

        return (
          <div
            key={ev.id}
            className="bg-[#141416] border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.04] via-transparent to-transparent p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
          >
            {/* Info Jadwal Hari Ini */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Schedule Hari Ini
                  </span>
                  <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                    <Clock size={12} /> {ev.time} WIB
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {ev.client}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white mt-1">
                  {ev.title}
                </h3>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                  <Users size={12} />
                  <span>Tag: {assigneesList.join(", ")}</span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi MoM Page & GMeet */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Link
                href={`/mom/${ev.id}`}
                className="h-8 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileText size={13} className="text-zinc-300" />
                <span>Notulen (MoM)</span>
              </Link>

              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Video size={13} />
                <span>Join GMeet</span>
                <ExternalLink size={11} className="opacity-60" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}