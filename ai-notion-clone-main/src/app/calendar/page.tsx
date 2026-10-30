"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  getCalendarEvents, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  respondCalendarEventApprovalAction,
  getUsersAction,
  syncUserAction,
  getClientsAction,
  createClientAction,
  updateClientAction,
  deleteClientAction
} from "@/actions/actions";
import { toast } from "sonner";
import { getGoogleCalendarUrl } from "@/lib/utils";
import { 
  getClientThemeByName, 
  COLOR_OPTIONS_LIST 
} from "@/lib/client-colors";
import Link from "next/link";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Tag, 
  Users, 
  X, 
  Trash2,
  FileText,
  Pencil,
  Video,
  MapPin,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

interface ScheduleEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  assignees: string[];
  eventType?: "online" | "offline" | string | null;
  meetLink?: string | null;
  location?: string | null;
  creatorName?: string | null;
  approvals?: Record<string, string> | any;
}

interface UserMember {
  id: string;
  name: string | null;
  email: string;
}

interface DbClient {
  id: string;
  name: string;
  color: string;
}

// Helper Format Tanggal Hari Ini (YYYY-MM-DD)
const getTodayFormatted = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CalendarPage() {
  const { user } = useUser();
  const creatorName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";

  // Set default bulan & tanggal sesuai hari ini
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("SIKA_CALENDAR_EVENTS");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted());
  
  // List User Terdaftar dari Clerk / Database
  const [dbUsers, setDbUsers] = useState<UserMember[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formClient, setFormClient] = useState("AKASA LAND");
  const [formDate, setFormDate] = useState(getTodayFormatted());
  const [formTime, setFormTime] = useState("10:00");
  const [formAssignees, setFormAssignees] = useState<string[]>([creatorName]);
  const [formEventType, setFormEventType] = useState<"online" | "offline">("online");
  const [formMeetLink, setFormMeetLink] = useState("https://meet.google.com/new");
  const [formLocation, setFormLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State validasi & pembuatan client baru di modal
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isAddingNewClientModal, setIsAddingNewClientModal] = useState(false);
  const [newClientModalName, setNewClientModalName] = useState("");
  const [newClientModalColor, setNewClientModalColor] = useState("sky");
  const [isSavingClientModal, setIsSavingClientModal] = useState(false);

  // State kelola & edit client di modal
  const [isManagingClientsModal, setIsManagingClientsModal] = useState(false);
  const [editingClientModal, setEditingClientModal] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editClientModalName, setEditClientModalName] = useState("");
  const [editClientModalColor, setEditClientModalColor] = useState("sky");
  const [isUpdatingClientModal, setIsUpdatingClientModal] = useState(false);
  const [deletingClientIdModal, setDeletingClientIdModal] = useState<string | null>(null);

  const handleStartEditClientModal = (c: DbClient) => {
    setEditingClientModal({ id: c.id, name: c.name, color: c.color || "sky" });
    setEditClientModalName(c.name);
    setEditClientModalColor(c.color || "sky");
    setIsAddingNewClientModal(false);
  };

  const handleUpdateClientModal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClientModal) return;
    const trimmed = editClientModalName.trim();
    if (!trimmed || isUpdatingClientModal) return;

    setIsUpdatingClientModal(true);
    try {
      const res = await updateClientAction(editingClientModal.id, {
        name: trimmed,
        color: editClientModalColor,
      });

      if (res && res.success && res.client) {
        setDbClients((prev) =>
          prev.map((c) => (c.id === editingClientModal.id ? res.client! : c))
        );
        if (formClient.toLowerCase() === editingClientModal.name.toLowerCase()) {
          setFormClient(res.client.name);
        }
        setEvents((prev) =>
          prev.map((ev) =>
            ev.client.toLowerCase() === editingClientModal.name.toLowerCase()
              ? { ...ev, client: res.client!.name }
              : ev
          )
        );
        setEditingClientModal(null);
      } else {
        alert(res?.error || "Gagal mengupdate client");
      }
    } catch (e: any) {
      alert("Gagal update client: " + e?.message);
    } finally {
      setIsUpdatingClientModal(false);
    }
  };

  const handleDeleteClientModal = async (id: string, name: string) => {
    if (!confirm(`Delete client "${name}" from database?`)) return;
    setDeletingClientIdModal(id);
    try {
      const res = await deleteClientAction(id);
      if (res && res.success) {
        setDbClients((prev) => prev.filter((c) => c.id !== id));
        if (formClient.toLowerCase() === name.toLowerCase()) {
          const remaining = dbClients.filter((c) => c.id !== id);
          setFormClient(remaining[0]?.name || "AKASA LAND");
        }
      } else {
        alert(res?.error || "Gagal menghapus client");
      }
    } catch (e: any) {
      alert("Gagal menghapus client: " + e?.message);
    } finally {
      setDeletingClientIdModal(null);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Background sync non-blocking
      syncUserAction().catch(() => {});

      const [eventsData, usersData, clientsData] = await Promise.all([
        getCalendarEvents(),
        getUsersAction(),
        getClientsAction()
      ]);

      if (eventsData && Array.isArray(eventsData)) {
        setEvents(eventsData);
        try {
          localStorage.setItem("SIKA_CALENDAR_EVENTS", JSON.stringify(eventsData));
        } catch {}
      }
      if (usersData && usersData.length > 0) {
        setDbUsers(usersData);
      }
      if (clientsData && clientsData.length > 0) {
        setDbClients(clientsData);
      }
    } catch (error) {
      console.error("Gagal memuat data:", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleOpenAddModal = (dateStr?: string) => {
    setEditingId(null);
    setFormDate(dateStr || selectedDate);
    setFormTitle("");
    setFormClient(dbClients[0]?.name || "AKASA LAND");
    setFormTime("10:00");
    setFormAssignees([creatorName]);
    setFormEventType("online");
    setFormMeetLink("https://meet.google.com/new");
    setFormLocation("");
    setAttemptedSubmit(false);
    setIsAddingNewClientModal(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: ScheduleEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormClient(ev.client);
    setFormDate(ev.date);
    setFormTime(ev.time);
    const existingAssignees = ev.assignees && ev.assignees.length > 0 
      ? ev.assignees 
      : [creatorName];
    setFormAssignees(existingAssignees);
    setFormEventType(ev.eventType === "offline" ? "offline" : "online");
    setFormMeetLink(ev.meetLink || (ev.eventType !== "offline" ? "https://meet.google.com/new" : ""));
    setFormLocation(ev.location || "");
    setSelectedDate(ev.date);
    setAttemptedSubmit(false);
    setIsAddingNewClientModal(false);
    setIsModalOpen(true);
  };

  const toggleAssignee = (name: string) => {
    // Pembuat acara (creator) selalu ada di daftar dan tidak bisa di-unselect
    if (name.toLowerCase() === creatorName.toLowerCase() || name.toLowerCase() === "you") return;
    setFormAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!formTitle.trim() || isSubmitting) return;

    // Validasi ketat link meeting & lokasi (tidak boleh kosong)
    if (formEventType === "online" && !formMeetLink.trim()) {
      return;
    }
    if (formEventType === "offline" && !formLocation.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Pastikan creator selalu masuk ke daftar assignees
      const finalAssignees = Array.from(new Set([creatorName, ...formAssignees]));

      let res: { success: boolean; error?: string };

      if (editingId) {
        res = await updateCalendarEvent(editingId, {
          title: formTitle.trim(),
          client: formClient,
          date: formDate,
          time: formTime,
          assignees: finalAssignees,
          eventType: formEventType,
          meetLink: formEventType === "online" ? formMeetLink.trim() : null,
          location: formEventType === "offline" ? formLocation.trim() : null,
          creatorName: creatorName,
        });
      } else {
        res = await createCalendarEvent({
          title: formTitle.trim(),
          client: formClient,
          date: formDate,
          time: formTime,
          assignees: finalAssignees,
          eventType: formEventType,
          meetLink: formEventType === "online" ? formMeetLink.trim() : null,
          location: formEventType === "offline" ? formLocation.trim() : null,
          creatorName: creatorName,
        });
      }

      if (res && res.success) {
        // Otomatis buka Google Calendar di tab baru saat jadwal baru dibuat
        if (!editingId) {
          const autoGCalUrl = getGoogleCalendarUrl({
            title: formTitle.trim(),
            client: formClient,
            date: formDate,
            time: formTime,
            assignees: finalAssignees,
            eventType: formEventType,
            meetLink: formEventType === "online" ? formMeetLink.trim() : null,
            location: formEventType === "offline" ? formLocation.trim() : null,
          });
          window.open(autoGCalUrl, "_blank");
        }

        await fetchInitialData();
        window.dispatchEvent(new Event("sika_schedule_updated"));
        setIsModalOpen(false);
        setSelectedDate(formDate);
      } else {
        alert("Server Error: " + (res?.error || "Failed to save schedule entry"));
      }
    } catch (error: any) {
      console.error("Failed to save event:", error);
      alert("Client Error: " + (error?.message || "A network or server error occurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await deleteCalendarEvent(id);
      if (res && res.success) {
        await fetchInitialData();
        if (editingId === id) {
          setIsModalOpen(false);
        }
      } else {
        alert("Failed to delete schedule entry.");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    calendarCells.push(`${year}-${formattedMonth}-${formattedDay}`);
  }

  const todayStr = getTodayFormatted();
  // Filter jadwal 1 bulan ke depan (30 hari)
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);
  const next30DaysStr = `${next30Days.getFullYear()}-${String(next30Days.getMonth() + 1).padStart(2, '0')}-${String(next30Days.getDate()).padStart(2, '0')}`;

  // Helper to check if logged-in user is tagged or creator
  const isUserTaggedOrCreator = (ev: ScheduleEvent) => {
    if (!user) return true;
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

    // 1. Check if user is the creator
    if (ev.creatorName) {
      const creator = ev.creatorName.toLowerCase().replace(/^@+/, "").trim();
      if (userIdentifiers.some((id) => id === creator || creator.includes(id) || id.includes(creator))) {
        return true;
      }
    }

    // 2. Collect all assignees from ev.assignees or ev.assignee
    const rawAssignees: string[] = [];
    if (Array.isArray(ev.assignees)) {
      rawAssignees.push(...ev.assignees);
    } else if (typeof ev.assignees === "string") {
      rawAssignees.push(...(ev.assignees as string).split(","));
    }

    if ((ev as any).assignee) {
      if (typeof (ev as any).assignee === "string") {
        rawAssignees.push(...(ev as any).assignee.split(","));
      } else if (Array.isArray((ev as any).assignee)) {
        rawAssignees.push(...(ev as any).assignee);
      }
    }

    // If no specific assignees are set, default to office-wide / team
    if (rawAssignees.length === 0) {
      return true;
    }

    return rawAssignees.some((a) => {
      const cleanA = a.toLowerCase().replace(/^@+/, "").trim();
      return userIdentifiers.some((id) => cleanA === id || cleanA.includes(id) || id.includes(cleanA));
    });
  };

  // Response for schedule approval in Upcoming List
  const handleApprovalResponse = async (ev: ScheduleEvent, status: "accepted" | "rejected") => {
    const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Member";

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((item) => {
        if (item.id !== ev.id) return item;
        const approvals = { ...(item.approvals || {}), [currentUserName]: status };
        return { ...item, approvals };
      })
    );

    try {
      const res = await respondCalendarEventApprovalAction(ev.id, currentUserName, status);
      if (res && res.success) {
        if (status === "accepted") {
          toast.success(`Schedule "${ev.title}" accepted!`);
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
        window.dispatchEvent(new Event("sika_schedule_updated"));
      } else {
        toast.error("Failed to update schedule status.");
      }
    } catch {
      toast.error("An error occurred while updating status.");
    }
  };

  // Upcoming Schedule: Displays all schedules tagging the user for the currently viewed month OR upcoming in 35 days
  const currentViewMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const upcomingEvents = events
    .filter((ev) => {
      if (!ev.date) return false;
      const isInCurrentViewedMonth = ev.date.startsWith(currentViewMonthPrefix);
      const isUpcomingIn35Days = ev.date >= todayStr && ev.date <= next30DaysStr;
      return isInCurrentViewedMonth || isUpcomingIn35Days;
    })
    .filter((ev) => {
      if (!isUserTaggedOrCreator(ev)) return false;
      const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
      const approvalsMap = (ev.approvals as Record<string, string>) || {};
      const myStatus = approvalsMap[currentUserName] || (user?.fullName ? approvalsMap[user.fullName] : undefined);
      if (myStatus === "rejected") return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));

  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-28 text-zinc-200">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Calendars & Schedule</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Click any schedule to edit details, assignees, or manage meeting minutes (MoM).
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-xs border border-zinc-800 transition flex items-center gap-1.5 shadow cursor-pointer"
            >
              <CalendarIcon size={14} className="text-sky-400" />
              <span>Google Calendar</span>
              <ExternalLink size={11} className="opacity-60" />
            </a>

            <button
              onClick={() => handleOpenAddModal()}
              className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition flex items-center gap-2 shadow cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>New Schedule</span>
            </button>
          </div>
        </div>

        {/* Layout Utama */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* UPCOMING LIST 1 BULAN (KIRI) */}
          <div className="lg:col-span-1 bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-[700px] shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Clock size={16} className="text-zinc-400" />
                <span>Upcoming Schedule</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                  {upcomingEvents.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
              {upcomingEvents.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 text-center">
                  <CalendarIcon size={20} className="opacity-40" />
                  <span>No upcoming schedules found for this period.</span>
                </div>
              ) : (
                upcomingEvents.map((ev) => {
                  const isSelected = ev.date === selectedDate;
                  const theme = getClientThemeByName(ev.client, dbClients);
                  const isOnline = ev.eventType !== "offline";

                  return (
                    <div
                      key={ev.id}
                      onClick={() => handleOpenEditModal(ev)}
                      className={`group p-3 rounded-xl border transition cursor-pointer flex flex-col gap-2.5 ${
                        isSelected
                          ? "bg-[#1f1f1f] border-zinc-600 shadow-md"
                          : "bg-[#181818] border-zinc-800/80 hover:border-zinc-600 hover:bg-[#1c1c1f]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-zinc-100 flex items-center gap-1.5">
                          <span>{ev.title}</span>
                          <Pencil size={11} className="opacity-0 group-hover:opacity-60 transition text-zinc-400 shrink-0" />
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(ev.id);
                          }}
                          className="text-zinc-500 hover:text-rose-400 transition p-0.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border flex items-center gap-1.5 ${theme.badge}`}>
                            <span 
                              className="w-1.5 h-1.5 rounded-full shrink-0" 
                              style={{ backgroundColor: theme.dot }} 
                            />
                            <span>{ev.client}</span>
                          </span>
                          {isOnline ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 flex items-center gap-1 shrink-0 font-medium">
                              <Video size={10} /> Online
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 flex items-center gap-1 shrink-0 font-medium">
                              <MapPin size={10} /> Offline
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-zinc-400 font-normal">
                          {ev.time}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {ev.assignees.map((person, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 font-medium"
                          >
                            @{person}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 flex-wrap gap-1">
                        <div className="text-xs text-zinc-400 font-normal flex items-center gap-1">
                          <CalendarIcon size={11} className="text-zinc-500" />
                          <span>{ev.date}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/mom/${ev.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[10px] font-medium transition flex items-center gap-1 cursor-pointer"
                          >
                            <FileText size={11} className="text-zinc-400" />
                            <span>MoM Notes</span>
                          </Link>
                        </div>
                      </div>

                      {/* Tombol Terima / Tolak untuk Assignee yang di-tag */}
                      {(() => {
                        const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
                        const isCreator = ev.creatorName && (
                          ev.creatorName.toLowerCase() === currentUserName.toLowerCase() ||
                          (user?.fullName && ev.creatorName.toLowerCase() === user.fullName.toLowerCase())
                        );
                        const approvalsMap = (ev.approvals as Record<string, string>) || {};
                        const myStatus = approvalsMap[currentUserName] || (isCreator ? "accepted" : "pending");

                        if (!isCreator && myStatus === "pending") {
                          return (
                            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-amber-600/20 bg-amber-950/20 p-2 rounded-lg">
                              <span className="text-[10px] text-zinc-400 font-medium">Respond:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalResponse(ev, "accepted");
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] flex items-center gap-1 transition shadow cursor-pointer active:scale-95"
                                  title="Accept schedule"
                                >
                                  <Check size={10} />
                                  <span>Accept</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalResponse(ev, "rejected");
                                  }}
                                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-400 text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                                  title="Decline schedule"
                                >
                                  <X size={10} />
                                  <span>Decline</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (!isCreator && myStatus === "accepted") {
                          return (
                            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium pt-0.5">
                              <Check size={10} />
                              <span>✓ Accepted</span>
                            </div>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* GRID KALENDER (KANAN) */}
          <div className="lg:col-span-3 bg-[#141414] border border-zinc-800/80 rounded-2xl p-6 flex flex-col h-[700px] shadow-xl">
            <div className="flex items-center justify-between pb-5 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {monthNames[month]} {year}
              </h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="w-8 h-8 rounded-xl bg-zinc-800/70 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center border border-zinc-700 transition cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDate(getTodayFormatted());
                  }}
                  className="px-3 h-8 rounded-xl bg-zinc-800/70 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-xl bg-zinc-800/70 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center border border-zinc-700 transition cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 pt-4 pb-2 text-center text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 flex-1 overflow-hidden">
              {calendarCells.map((dateStr, idx) => {
                if (!dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="bg-transparent rounded-xl border border-transparent"
                    />
                  );
                }

                const dayNumber = parseInt(dateStr.split("-")[2], 10);
                const dayEvents = events.filter((e) => e.date === dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      handleOpenAddModal(dateStr);
                    }}
                    className={`relative p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer group select-none ${
                      isSelected
                        ? "bg-[#1c1c1f] border-zinc-500 ring-1 ring-zinc-500/30"
                        : "bg-[#121212] border-zinc-800/70 hover:border-zinc-700 hover:bg-[#181818]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                          isToday
                            ? "bg-blue-600 text-white font-bold"
                            : isSelected
                            ? "bg-white text-black font-bold"
                            : "text-zinc-300 group-hover:text-white"
                        }`}
                      >
                        {dayNumber}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddModal(dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white transition p-0.5 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="space-y-1 my-1 overflow-y-auto max-h-16 flex-1 pr-0.5">
                      {dayEvents.map((ev) => {
                        const theme = getClientThemeByName(ev.client, dbClients);

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(ev);
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded border truncate font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${theme.badge}`}
                          >
                            <span 
                              className="w-1.5 h-1.5 rounded-full shrink-0" 
                              style={{ backgroundColor: theme.dot }} 
                            />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="h-1 flex items-center gap-1">
                      {dayEvents.length > 0 && (
                        <span className="text-[9px] text-zinc-500 font-medium">
                          {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* MODAL SCHEDULE (ADD & EDIT) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  {editingId ? (
                    <Pencil size={16} className="text-amber-400" />
                  ) : (
                    <CalendarIcon size={16} className="text-white" />
                  )}
                  <h3 className="text-sm font-bold text-white">
                    {editingId ? "Edit Schedule Entry" : "Create Schedule Entry"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitEvent} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium">
                    Event Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Client Strategy Meeting"
                    className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium flex items-center gap-1">
                      <Tag size={12} /> Client Tag
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsManagingClientsModal(!isManagingClientsModal);
                          setIsAddingNewClientModal(false);
                          setEditingClientModal(null);
                        }}
                        className="text-[11px] text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil size={10} />
                        <span>{isManagingClientsModal ? "Close" : "Manage Clients"}</span>
                      </button>
                      {!isAddingNewClientModal && !isManagingClientsModal && !editingClientModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewClientModal(true);
                            setIsManagingClientsModal(false);
                            setEditingClientModal(null);
                          }}
                          className="text-[11px] text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={11} /> + New Client
                        </button>
                      )}
                    </div>
                  </div>

                  {editingClientModal ? (
                    <form onSubmit={handleUpdateClientModal} className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">Edit Client</span>
                        <button
                          type="button"
                          onClick={() => setEditingClientModal(null)}
                          className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={editClientModalName}
                        onChange={(e) => setEditClientModalName(e.target.value)}
                        placeholder="Nama client..."
                        className="w-full bg-[#121214] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Pilihan Warna (Soft):</span>
                        <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {COLOR_OPTIONS_LIST.map((opt) => {
                            const isPicked = editClientModalColor === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setEditClientModalColor(opt.key)}
                                title={opt.label}
                                className={`h-6 rounded-md flex items-center justify-center transition cursor-pointer border ${
                                  isPicked ? "ring-2 ring-white border-white scale-105" : "border-zinc-700/60 hover:scale-105"
                                }`}
                                style={{ backgroundColor: opt.dot }}
                              >
                                {isPicked && <Check size={12} className="text-black font-bold" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingClientModal(null)}
                          className="px-2 py-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={!editClientModalName.trim() || isUpdatingClientModal}
                          className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white text-black hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          {isUpdatingClientModal ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </form>
                  ) : isAddingNewClientModal ? (
                    <div className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">Create New Client</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingNewClientModal(false)}
                          className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={newClientModalName}
                        onChange={(e) => setNewClientModalName(e.target.value)}
                        placeholder="Client name (e.g. BABA)..."
                        className="w-full bg-[#121214] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Color Palette:</span>
                        <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {COLOR_OPTIONS_LIST.map((opt) => {
                            const isPicked = newClientModalColor === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setNewClientModalColor(opt.key)}
                                title={opt.label}
                                className={`h-6 rounded-md flex items-center justify-center transition cursor-pointer border ${
                                  isPicked ? "ring-2 ring-white border-white scale-105" : "border-zinc-700/60 hover:scale-105"
                                }`}
                                style={{ backgroundColor: opt.dot }}
                              >
                                {isPicked && <Check size={12} className="text-black font-bold" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingNewClientModal(false)}
                          className="px-2 py-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newClientModalName.trim() || isSavingClientModal}
                          onClick={async () => {
                            const trimmed = newClientModalName.trim();
                            if (!trimmed || isSavingClientModal) return;
                            setIsSavingClientModal(true);
                            try {
                              const res = await createClientAction({
                                name: trimmed,
                                color: newClientModalColor,
                              });
                              if (res && res.success && res.client) {
                                setDbClients((prev) => {
                                  const filtered = prev.filter((c) => c.name.toLowerCase() !== trimmed.toLowerCase());
                                  return [...filtered, res.client].sort((a, b) => a.name.localeCompare(b.name));
                                });
                                setFormClient(res.client.name);
                                setNewClientModalName("");
                                setIsAddingNewClientModal(false);
                              } else {
                                alert(res?.error || "Failed to create client");
                              }
                            } catch (e: any) {
                              alert("Failed to create client: " + e?.message);
                            } finally {
                              setIsSavingClientModal(false);
                            }
                          }}
                          className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white text-black hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          {isSavingClientModal ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          <span>Save Client</span>
                        </button>
                      </div>
                    </div>
                  ) : isManagingClientsModal ? (
                    <div className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                        <span className="text-[11px] font-semibold text-white">Client List & Management</span>
                        <button
                          type="button"
                          onClick={() => setIsManagingClientsModal(false)}
                          className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {dbClients.map((c) => {
                          const theme = getClientThemeByName(c.name, dbClients);
                          return (
                            <div
                              key={c.id || c.name}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#141416] border border-zinc-800/80 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: theme.dot }} />
                                <span className={`px-2 py-0.5 rounded border text-[11px] font-medium truncate ${theme.badge}`}>
                                  {c.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditClientModal(c)}
                                  title="Edit Client"
                                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  type="button"
                                  disabled={deletingClientIdModal === c.id}
                                  onClick={() => handleDeleteClientModal(c.id, c.name)}
                                  title="Delete Client"
                                  className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  {deletingClientIdModal === c.id ? (
                                    <Loader2 size={11} className="animate-spin text-rose-400" />
                                  ) : (
                                    <Trash2 size={11} />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="pt-1.5 border-t border-zinc-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewClientModal(true);
                            setIsManagingClientsModal(false);
                          }}
                          className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <Plus size={12} /> + Add New Client
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formClient}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setIsAddingNewClientModal(true);
                        } else {
                          setFormClient(e.target.value);
                        }
                      }}
                      className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 cursor-pointer text-xs"
                    >
                      {dbClients.map((c) => (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__NEW__">+ Add New Client...</option>
                    </select>
                  )}
                </div>

                {/* Assignees */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium flex items-center gap-1">
                      <Users size={12} /> Assignees ({formAssignees.length} selected)
                    </label>
                    {formAssignees.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormAssignees([creatorName])}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      >
                        Reset to You
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#1c1c1f] border border-zinc-800 rounded-xl max-h-32 overflow-y-auto">
                    {/* Pembuat jadwal terkunci otomatis sebagai assignee */}
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-black border border-white flex items-center gap-1.5 shadow-sm opacity-95 cursor-default"
                      title="Pembuat acara otomatis selalu masuk sebagai assignee"
                    >
                      <span>{creatorName} (You)</span>
                      <Check size={11} className="font-bold" />
                    </button>

                    {/* Hanya tampilkan user terdaftar di database */}
                    {dbUsers
                      .filter((u) => {
                        const name = u.name || u.email;
                        return (
                          name.toLowerCase() !== creatorName.toLowerCase() &&
                          name.toLowerCase() !== "you"
                        );
                      })
                      .map((u) => {
                        const displayName = u.name || u.email;
                        const isSelected = formAssignees.includes(displayName);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleAssignee(displayName)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? "bg-white text-black border-white shadow-sm font-semibold"
                                : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60 hover:text-zinc-200 hover:bg-zinc-700"
                            }`}
                          >
                            <span>{displayName}</span>
                            {isSelected && <Check size={11} className="font-bold" />}
                          </button>
                        );
                      })}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    * Assigned team members will receive this schedule in their agenda.
                  </p>
                </div>

                {/* Event Format: Online vs Offline */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium">Meeting Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormEventType("online");
                        if (!formMeetLink) setFormMeetLink("https://meet.google.com/new");
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        formEventType === "online"
                          ? "bg-[#27272a] text-white border-zinc-600 shadow-xs"
                          : "bg-[#161619] text-zinc-400 border-zinc-800/80 hover:text-zinc-200"
                      }`}
                    >
                      <Video size={13} />
                      <span>Online Meeting</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormEventType("offline")}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        formEventType === "offline"
                          ? "bg-[#27272a] text-white border-zinc-600 shadow-xs"
                          : "bg-[#161619] text-zinc-400 border-zinc-800/80 hover:text-zinc-200"
                      }`}
                    >
                      <MapPin size={13} />
                      <span>Offline Meeting</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Field: Meet Link jika Online, Lokasi jika Offline - Peringatan Wajib Diisi hanya muncul saat dikosongkan */}
                {formEventType === "online" ? (
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-medium flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Video size={12} className="text-zinc-400" /> Meeting Link (GMeet / Zoom) <span className="text-zinc-500">*</span>
                      </span>
                      {attemptedSubmit && !formMeetLink.trim() && (
                        <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 animate-pulse">
                          <AlertCircle size={11} /> Required
                        </span>
                      )}
                    </label>
                    <input
                      type="url"
                      required
                      value={formMeetLink}
                      onChange={(e) => setFormMeetLink(e.target.value)}
                      placeholder="https://meet.google.com/xyz"
                      className={`w-full bg-[#1c1c1f] border rounded-xl px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none text-xs transition ${
                        attemptedSubmit && !formMeetLink.trim()
                          ? "border-rose-500/80 focus:border-rose-500"
                          : "border-zinc-800 focus:border-indigo-500"
                      }`}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-medium flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-zinc-400" /> Location / Address <span className="text-zinc-500">*</span>
                      </span>
                      {attemptedSubmit && !formLocation.trim() && (
                        <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 animate-pulse">
                          <AlertCircle size={11} /> Required
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Sika Office, Semarang / Client Address"
                      className={`w-full bg-[#1c1c1f] border rounded-xl px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none text-xs transition ${
                        attemptedSubmit && !formLocation.trim()
                          ? "border-rose-500/80 focus:border-rose-500"
                          : "border-zinc-800 focus:border-emerald-500"
                      }`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                      <CalendarIcon size={12} /> Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                      <Clock size={12} /> Time
                    </label>
                    <input
                      type="time"
                      required
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingId)}
                      title="Delete Schedule"
                      className="p-2.5 rounded-xl border border-rose-900/60 text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition font-medium cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold transition shadow cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Save Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MobileContainer>
  );
}