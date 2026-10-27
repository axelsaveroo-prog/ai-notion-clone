"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  getCalendarEvents, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  getUsersAction,
  syncUserAction,
  getClientsAction,
  createClientAction,
  updateClientAction,
  deleteClientAction
} from "@/actions/actions";
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
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
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
    if (!confirm(`Hapus client "${name}" dari database?`)) return;
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
      await syncUserAction();

      const [eventsData, usersData, clientsData] = await Promise.all([
        getCalendarEvents(),
        getUsersAction(),
        getClientsAction()
      ]);

      if (eventsData) setEvents(eventsData);
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
        alert("Pesan Error Server: " + (res?.error || "Gagal menyimpan jadwal"));
      }
    } catch (error: any) {
      console.error("Gagal menyimpan event:", error);
      alert("Error Client: " + (error?.message || "Terjadi kesalahan jaringan/server"));
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
        alert("Gagal menghapus jadwal.");
      }
    } catch (error) {
      console.error("Gagal menghapus event:", error);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
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

  // Upcoming Schedule: jadwal selama 1 bulan ke depan (jadwal lewat tidak ditampilkan)
  const upcomingEvents = events
    .filter((ev) => ev.date >= todayStr && ev.date <= next30DaysStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

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
                <span className="text-[10px] text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-800">
                  1 Bulan
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                  {upcomingEvents.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
              {upcomingEvents.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 text-center">
                  <CalendarIcon size={20} className="opacity-40" />
                  <span>Tidak ada jadwal untuk 30 hari ke depan.</span>
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
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shrink-0">
                              <Video size={10} /> Online
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                              <MapPin size={10} /> Offline
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-zinc-400 font-mono">
                          {ev.time}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {ev.assignees.map((person, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-mono"
                          >
                            @{person}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 flex-wrap gap-1">
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
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
                            <span>Notulen MoM</span>
                          </Link>
                        </div>
                      </div>
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
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {dayEvents.length} event
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
                        <span>{isManagingClientsModal ? "Tutup Kelola" : "Kelola Client"}</span>
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
                          <Plus size={11} /> + Client Baru
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
                          <span>Simpan Perubahan</span>
                        </button>
                      </div>
                    </form>
                  ) : isAddingNewClientModal ? (
                    <div className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">Buat Client Baru</span>
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
                        placeholder="Nama client (misal: BABA)..."
                        className="w-full bg-[#121214] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                      <div>
                        <span className="text-[10px] text-zinc-400 block mb-1">Pilihan Warna (Soft):</span>
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
                          Batal
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
                                alert(res?.error || "Gagal membuat client");
                              }
                            } catch (e: any) {
                              alert("Gagal membuat client: " + e?.message);
                            } finally {
                              setIsSavingClientModal(false);
                            }
                          }}
                          className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white text-black hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          {isSavingClientModal ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          <span>Simpan Client</span>
                        </button>
                      </div>
                    </div>
                  ) : isManagingClientsModal ? (
                    <div className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                        <span className="text-[11px] font-semibold text-white">Daftar & Kelola Client</span>
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
                                  title="Hapus Client"
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
                          <Plus size={12} /> + Tambah Client Baru
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
                      <option value="__NEW__">+ Tambah Client Baru...</option>
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
                    * User yang di-assign akan langsung menerima jadwal ini di beranda mereka.
                  </p>
                </div>

                {/* Event Format: Online vs Offline */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium">Format Acara / Meeting</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormEventType("online");
                        if (!formMeetLink) setFormMeetLink("https://meet.google.com/new");
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        formEventType === "online"
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm"
                          : "bg-[#1c1c1f] text-zinc-400 border-zinc-800 hover:text-zinc-200"
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
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                          : "bg-[#1c1c1f] text-zinc-400 border-zinc-800 hover:text-zinc-200"
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
                        <Video size={12} className="text-indigo-400" /> Link Meeting (GMeet / Zoom) <span className="text-zinc-500">*</span>
                      </span>
                      {attemptedSubmit && !formMeetLink.trim() && (
                        <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 animate-pulse">
                          <AlertCircle size={11} /> Wajib diisi
                        </span>
                      )}
                    </label>
                    <input
                      type="url"
                      required
                      value={formMeetLink}
                      onChange={(e) => setFormMeetLink(e.target.value)}
                      placeholder="https://meet.google.com/xyz"
                      className={`w-full bg-[#1c1c1f] border rounded-xl px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none text-xs font-mono transition ${
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
                        <MapPin size={12} className="text-emerald-400" /> Lokasi / Alamat Meeting <span className="text-zinc-500">*</span>
                      </span>
                      {attemptedSubmit && !formLocation.trim() && (
                        <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 animate-pulse">
                          <AlertCircle size={11} /> Wajib diisi
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Kantor Sika, Semarang / Alamat Klien"
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
                      className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 font-mono"
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
                      className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingId)}
                      title="Hapus Jadwal"
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