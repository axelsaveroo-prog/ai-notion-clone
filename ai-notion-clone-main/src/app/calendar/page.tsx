"use client";

import { useState, useEffect } from "react";
import { 
  getCalendarEvents, 
  createCalendarEvent, 
  updateCalendarEvent, 
  deleteCalendarEvent,
  getUsersAction,
  syncUserAction
} from "@/actions/actions";
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
  Pencil
} from "lucide-react";
import { MobileContainer } from "@/components/MobileContainer";

interface ScheduleEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  assignees: string[];
}

interface UserMember {
  id: string;
  name: string | null;
  email: string;
}

const CLIENT_THEMES: Record<string, { badge: string; dot: string }> = {
  "AKASA LAND": {
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25",
    dot: "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]",
  },
  "APERIO": {
    badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25",
    dot: "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]",
  },
  "BALI FINE GALLERY": {
    badge: "bg-teal-500/15 text-teal-300 border-teal-500/30 hover:bg-teal-500/25",
    dot: "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]",
  },
  "WEARLUCA": {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25",
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  },
};

const getClientTheme = (client: string) => {
  return (
    CLIENT_THEMES[client] || {
      badge: "bg-zinc-800/90 text-zinc-300 border-zinc-700",
      dot: "bg-zinc-400",
    }
  );
};

// Helper Format Tanggal Hari Ini (YYYY-MM-DD)
const getTodayFormatted = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CalendarPage() {
  // Set default bulan & tanggal sesuai hari ini
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted());
  
  // List User Terdaftar dari Clerk / Database
  const [dbUsers, setDbUsers] = useState<UserMember[]>([]);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formClient, setFormClient] = useState("AKASA LAND");
  const [formDate, setFormDate] = useState(getTodayFormatted());
  const [formTime, setFormTime] = useState("10:00");
  const [formAssignees, setFormAssignees] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInitialData = async () => {
    try {
      await syncUserAction();

      const [eventsData, usersData] = await Promise.all([
        getCalendarEvents(),
        getUsersAction()
      ]);

      if (eventsData) setEvents(eventsData);
      if (usersData && usersData.length > 0) {
        setDbUsers(usersData);
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
    setFormClient("AKASA LAND");
    setFormTime("10:00");
    setFormAssignees([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ev: ScheduleEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormClient(ev.client);
    setFormDate(ev.date);
    setFormTime(ev.time);
    setFormAssignees(ev.assignees || []);
    setSelectedDate(ev.date);
    setIsModalOpen(true);
  };

  const toggleAssignee = (name: string) => {
    setFormAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateCalendarEvent(editingId, {
          title: formTitle.trim(),
          client: formClient,
          date: formDate,
          time: formTime,
          assignees: formAssignees,
        });
      } else {
        await createCalendarEvent({
          title: formTitle.trim(),
          client: formClient,
          date: formDate,
          time: formTime,
          assignees: formAssignees,
        });
      }

      await fetchInitialData();
      setIsModalOpen(false);
      setSelectedDate(formDate);
      alert("Jadwal berhasil disimpan!");
    } catch (error: any) {
      console.error("Detail Error:", error);
      // Tampilkan error message asli dari Prisma/Server Action
      const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      alert("Detail Error Server: " + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      await fetchInitialData();
      if (editingId === id) {
        setIsModalOpen(false);
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

  const sortedEvents = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
  );

  const todayStr = getTodayFormatted();

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

          <button
            onClick={() => handleOpenAddModal()}
            className="h-10 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition flex items-center gap-2 shadow cursor-pointer self-start sm:self-auto"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Schedule</span>
          </button>
        </div>

        {/* Layout Utama */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* UPCOMING LIST (KIRI) */}
          <div className="lg:col-span-1 bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-[700px] shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Clock size={16} className="text-zinc-400" />
                <span>Upcoming List</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                {events.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
              {sortedEvents.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 text-center">
                  <CalendarIcon size={20} className="opacity-40" />
                  <span>Belum ada jadwal yang dibuat.</span>
                </div>
              ) : (
                sortedEvents.map((ev) => {
                  const isSelected = ev.date === selectedDate;
                  const theme = getClientTheme(ev.client);

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

                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${theme.badge}`}>
                          {ev.client}
                        </span>
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

                      <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60">
                        <div className="text-[10px] text-zinc-500 font-mono">
                          📅 {ev.date}
                        </div>

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
                        const theme = getClientTheme(ev.client);

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(ev);
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded border truncate font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${theme.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
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
                  <label className="block text-zinc-400 mb-1.5 font-medium">Event Title</label>
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
                  <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                    <Tag size={12} /> Client Tag
                  </label>
                  <select
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
                  >
                    <option value="AKASA LAND">AKASA LAND</option>
                    <option value="APERIO">APERIO</option>
                    <option value="BALI FINE GALLERY">BALI FINE GALLERY</option>
                    <option value="WEARLUCA">WEARLUCA</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium flex items-center gap-1">
                      <Users size={12} /> Assignees ({formAssignees.length} selected)
                    </label>
                    {formAssignees.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormAssignees([])}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {dbUsers.length === 0 ? (
                    <div className="p-3 bg-[#1c1c1f] border border-zinc-800 rounded-xl text-zinc-500 text-[11px] italic">
                      Memuat anggota terdaftar...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#1c1c1f] border border-zinc-800 rounded-xl max-h-32 overflow-y-auto">
                      {dbUsers.map((u) => {
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
                            {isSelected && <span className="text-[10px] font-bold">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

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
                    {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Add Event"}
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