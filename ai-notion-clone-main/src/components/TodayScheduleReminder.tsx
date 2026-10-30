import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { 
  Clock, 
  Video, 
  FileText, 
  Users, 
  ExternalLink,
  MapPin,
  CheckCircle2,
  Calendar as CalendarIcon,
  Check,
  X as XIcon,
  HelpCircle
} from "lucide-react";
import { getCalendarEvents, respondCalendarEventApprovalAction } from "@/actions/actions";
import { getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";

export interface ScheduleEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  assignees?: string[];
  assignee?: string;
  eventType?: "online" | "offline" | string | null;
  meetLink?: string | null;
  location?: string | null;
  creatorName?: string | null;
  approvals?: Record<string, string> | any;
}

export function TodayScheduleReminder() {
  const { user } = useUser();
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ambil tanggal lokal hari ini dalam format YYYY-MM-DD
  const getTodayStr = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayStr();

  // Load dismissed items from localStorage for today
  useEffect(() => {
    try {
      const savedDismissed = localStorage.getItem(`SIKA_DISMISSED_REMINDERS_${todayStr}`);
      if (savedDismissed) {
        setDismissedIds(JSON.parse(savedDismissed));
      }
    } catch {
      setDismissedIds([]);
    }
  }, [todayStr]);

  // Fetch real events from database
  const loadEvents = useCallback(async () => {
    try {
      const events: any = await getCalendarEvents();
      if (events && Array.isArray(events)) {
        const filtered = events.filter((ev: ScheduleEvent) => ev.date === todayStr);
        setTodayEvents(filtered);

        // Sync ke localStorage agar komponen offline/MoM tetap sinkron
        try {
          localStorage.setItem("SIKA_CALENDAR_EVENTS", JSON.stringify(events));
        } catch {}
      }
    } catch (err) {
      console.error("Gagal memuat jadwal hari ini dari database:", err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadEvents();

    const handleRefresh = () => loadEvents();
    window.addEventListener("sika_schedule_updated", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("sika_schedule_updated", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [loadEvents]);

  // Bulletproof filter: user tagged or creator
  const isEventForCurrentUser = (ev: ScheduleEvent) => {
    if (!user) return false;

    const currentUserName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "";
    const approvalsMap = (ev.approvals as Record<string, string>) || {};
    if (approvalsMap[currentUserName] === "rejected") return false;

    const userIdentifiers = [
      user.id?.toLowerCase().trim(),
      user.fullName?.toLowerCase().trim(),
      user.firstName?.toLowerCase().trim(),
      user.lastName?.toLowerCase().trim(),
      user.username?.toLowerCase().trim(),
      user.primaryEmailAddress?.emailAddress?.toLowerCase().trim(),
      "you",
      "team",
      "all",
      "everyone",
      "member",
    ].filter(Boolean) as string[];

    if (ev.creatorName) {
      const creator = ev.creatorName.toLowerCase().replace(/^@+/, "").trim();
      if (userIdentifiers.some((id) => id === creator || creator.includes(id) || id.includes(creator))) {
        return true;
      }
    }

    const rawAssignees: string[] = [];
    if (Array.isArray(ev.assignees)) {
      rawAssignees.push(...ev.assignees);
    } else if (typeof ev.assignees === "string") {
      rawAssignees.push(...(ev.assignees as string).split(","));
    }

    if (ev.assignee) {
      if (typeof ev.assignee === "string") {
        rawAssignees.push(...ev.assignee.split(","));
      } else if (Array.isArray(ev.assignee)) {
        rawAssignees.push(...ev.assignee);
      }
    }

    if (rawAssignees.length === 0) {
      return true;
    }

    return rawAssignees.some((assignee) => {
      const cleanA = assignee.toLowerCase().replace(/^@+/, "").trim();
      return userIdentifiers.some((id) => cleanA === id || cleanA.includes(id) || id.includes(cleanA));
    });
  };

  // Response Persetujuan Jadwal oleh Assignee
  const handleApprovalResponse = async (ev: ScheduleEvent, status: "accepted" | "rejected") => {
    const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Member";
    const res = await respondCalendarEventApprovalAction(ev.id, currentUserName, status);
    if (res && res.success) {
      if (status === "accepted") {
        toast.success(`Schedule "${ev.title}" accepted!`);
        // Otomatis buka Google Calendar untuk user yang menyetujui
        const gCalUrl = getGoogleCalendarUrl({
          title: ev.title,
          date: ev.date,
          time: ev.time,
          client: ev.client,
          assignees: ev.assignees,
          eventType: ev.eventType,
          meetLink: ev.meetLink,
          location: ev.location,
        });
        window.open(gCalUrl, "_blank");
      } else {
        toast.info(`Schedule "${ev.title}" declined.`);
      }
      await loadEvents();
      window.dispatchEvent(new Event("sika_schedule_updated"));
    } else {
      toast.error("Failed to update approval status.");
    }
  };

  // Tandai selesai (menghilangkan reminder)
  const handleMarkDone = (id: string, title: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem(`SIKA_DISMISSED_REMINDERS_${todayStr}`, JSON.stringify(updated));
    } catch {}
    toast.success(`Schedule "${title}" marked as complete!`);
  };

  // Filter out event yang bukan untuk user ini atau sudah ditandai Done
  const visibleEvents = todayEvents
    .filter(isEventForCurrentUser)
    .filter((ev) => !dismissedIds.includes(ev.id));

  // Jika tidak ada agenda yang perlu ditampilkan, sembunyikan bar reminder
  if (isLoading || visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {visibleEvents.map((ev) => {
        const assigneesList = ev.assignees && ev.assignees.length > 0 
          ? ev.assignees 
          : (ev.assignee ? [ev.assignee] : ["Team"]);
        
        const isOnline = ev.eventType !== "offline";
        const meetUrl = ev.meetLink && ev.meetLink.trim() !== "" 
          ? ev.meetLink 
          : "https://meet.google.com/new";

        const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
        const isCreator = ev.creatorName && (
          ev.creatorName.toLowerCase() === currentUserName.toLowerCase() ||
          (user?.fullName && ev.creatorName.toLowerCase() === user.fullName.toLowerCase()) ||
          (user?.primaryEmailAddress?.emailAddress && ev.creatorName.toLowerCase() === user.primaryEmailAddress.emailAddress.toLowerCase())
        );

        // Ambil status persetujuan user saat ini
        const approvalsMap = (ev.approvals as Record<string, string>) || {};
        const userApprovalStatus = approvalsMap[currentUserName] || (isCreator ? "accepted" : "pending");
        const needsApproval = !isCreator && userApprovalStatus === "pending";

        return (
          <div
            key={ev.id}
            className="group relative bg-[#141416] p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border border-zinc-800/80 hover:border-zinc-700"
          >
            {/* Info Jadwal Hari Ini */}
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <CalendarIcon size={18} className="text-zinc-300" />
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                {/* Baris Atas: HANYA Badge Jadwal, Status Online/Offline, dan Status Persetujuan */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-[#22201d] text-[#ded2be] border border-[#383329]">
                    Schedule Hari Ini
                  </span>
                  
                  {isOnline ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#1c1e22] text-[#c5c9d1] border border-[#2c3038] flex items-center gap-1">
                      <Video size={11} /> Online Meeting
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d221f] text-[#c4d2c8] border border-[#2b352e] flex items-center gap-1">
                      <MapPin size={11} /> Offline Meeting
                    </span>
                  )}

                  {/* Badge Persetujuan Assignee */}
                  {needsApproval ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#24211c] text-[#ded0b6] border border-[#3d3426] flex items-center gap-1">
                      <HelpCircle size={11} /> Pending Confirmation
                    </span>
                  ) : userApprovalStatus === "accepted" ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d221f] text-[#c4d2c8] border border-[#2b352e] flex items-center gap-1">
                      <Check size={11} /> Accepted
                    </span>
                  ) : userApprovalStatus === "rejected" ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#241e1e] text-[#d9c4c4] border border-[#3a2c2c] flex items-center gap-1">
                      <XIcon size={11} /> Declined
                    </span>
                  ) : null}
                </div>

                {/* Judul Jadwal */}
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight break-words">
                  {ev.title}
                </h3>

                {/* Informasi Schedule DI BAWAH JUDUL */}
                <div className="flex items-center gap-2.5 text-[11px] text-zinc-400 flex-wrap pt-0.5">
                  <span className="text-xs text-zinc-200 font-normal flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                    <Clock size={12} className="text-amber-400" /> {ev.time} WIB
                  </span>

                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                    {ev.client}
                  </span>

                  <span className="flex items-center gap-1 text-zinc-400">
                    <Users size={12} className="text-zinc-500" />
                    <span>Assigned: {assigneesList.join(", ")}</span>
                  </span>

                  {!isOnline && ev.location && (
                    <span className="flex items-center gap-1 text-zinc-300 font-medium">
                      <MapPin size={12} className="text-emerald-400" />
                      <span>{ev.location}</span>
                    </span>
                  )}

                  {ev.creatorName && (
                    <span className="text-[10px] text-zinc-500">
                      (Created by: {ev.creatorName})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tombol Aksi: Persetujuan (jika perlu), MoM, GMeet, dan Selesai */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">


              {/* Tombol Notulen MoM */}
              <Link
                href={`/mom/${ev.id}`}
                className="h-8 px-3 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <FileText size={13} className="text-zinc-300" />
                <span>MoM Notes</span>
              </Link>

              {/* Tombol Join GMeet - HANYA TAMPIL JIKA ONLINE */}
              {isOnline && (
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  <Video size={13} className="text-black" />
                  <span>Join GMeet</span>
                  <ExternalLink size={11} className="opacity-60" />
                </a>
              )}

              {/* Tombol Centang / Done untuk Menghilangkan Reminder */}
              <button
                type="button"
                onClick={() => handleMarkDone(ev.id, ev.title)}
                title="Mark as complete (Dismiss this reminder)"
                className="h-8 px-3 rounded-xl bg-zinc-900/90 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700/60 text-zinc-400 border border-zinc-800 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Done</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}