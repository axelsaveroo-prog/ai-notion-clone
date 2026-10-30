"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Users, 
  ExternalLink, 
  Video, 
  MapPin, 
  Clock, 
  Tag, 
  X,
  ArrowRight,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2
} from "lucide-react";
import { 
  getCalendarEvents, 
  createCalendarEvent, 
  getUsersAction,
  getClientsAction,
  createClientAction,
  updateClientAction,
  deleteClientAction,
  respondCalendarEventApprovalAction
} from "@/actions/actions";
import { getGoogleCalendarUrl } from "@/lib/utils";
import { 
  getClientThemeByName, 
  COLOR_OPTIONS_LIST 
} from "@/lib/client-colors";
import { toast } from "sonner";

interface EventItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  client: string;
  assignees?: string[];
  assignee?: string;
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

const getTodayFormatted = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function TeamCalendar() {
  const { user } = useUser();
  const creatorName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";

  const [events, setEvents] = useState<EventItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("SIKA_CALENDAR_EVENTS");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserMember[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);

  // State Modal Add Schedule
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        toast.success(`Client "${res.client.name}" berhasil diupdate!`);
      } else {
        toast.error(res?.error || "Gagal mengupdate client");
      }
    } catch {
      toast.error("Gagal mengupdate client");
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
        toast.success(`Client "${name}" berhasil dihapus.`);
      } else {
        toast.error(res?.error || "Gagal menghapus client");
      }
    } catch {
      toast.error("Gagal menghapus client");
    } finally {
      setDeletingClientIdModal(null);
    }
  };

  // Quick title input di bar schedule
  const [quickTitle, setQuickTitle] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [eventsData, usersData, clientsData] = await Promise.all([
        getCalendarEvents(),
        getUsersAction(),
        getClientsAction(),
      ]);

      if (eventsData && Array.isArray(eventsData)) {
        setEvents(eventsData);
        try {
          localStorage.setItem("SIKA_CALENDAR_EVENTS", JSON.stringify(eventsData));
        } catch {}
      }
      if (usersData && Array.isArray(usersData)) {
        setDbUsers(usersData);
      }
      if (clientsData && Array.isArray(clientsData)) {
        setDbClients(clientsData);
      }
    } catch (err) {
      console.error("Gagal memuat event:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleRefresh = () => loadData();
    window.addEventListener("sika_schedule_updated", handleRefresh);
    window.addEventListener("storage", handleRefresh);

    return () => {
      window.removeEventListener("sika_schedule_updated", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [loadData]);

  const handleOpenModalWithQuickTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTitle.trim()) {
      setFormTitle(quickTitle.trim());
    }
    setFormDate(getTodayFormatted());
    setFormTime("10:00");
    setFormClient(dbClients[0]?.name || "AKASA LAND");
    setFormAssignees([creatorName]);
    setFormEventType("online");
    setFormMeetLink("https://meet.google.com/new");
    setFormLocation("");
    setAttemptedSubmit(false);
    setIsAddingNewClientModal(false);
    setIsModalOpen(true);
  };

  const toggleAssignee = (name: string) => {
    // Pembuat acara (creator) otomatis selalu ada di assignees dan tidak bisa di-unselect
    if (name === creatorName || name === "You") return;
    setFormAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!formTitle.trim() || isSubmitting) return;

    // Validasi wajib diisi untuk link meeting atau lokasi
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

      const res = await createCalendarEvent({
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

      if (res && res.success) {
        toast.success("New schedule entry saved & opened in Google Calendar!");
        
        // Otomatis buka Google Calendar di tab baru saat event dibuat tanpa perlu klik tombol manual
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

        setQuickTitle("");
        setFormTitle("");
        setIsModalOpen(false);
        await loadData();
        window.dispatchEvent(new Event("sika_schedule_updated"));
      } else {
        toast.error("Failed to save schedule: " + (res?.error || "Server error"));
      }
    } catch (err: any) {
      console.error("Error saving event:", err);
      toast.error("Failed to save schedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulletproof helper to check if logged-in user is tagged or creator
  const isUserTaggedOrCreator = (ev: EventItem) => {
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

    return rawAssignees.some((a) => {
      const cleanA = a.toLowerCase().replace(/^@+/, "").trim();
      return userIdentifiers.some((id) => cleanA === id || cleanA.includes(id) || id.includes(cleanA));
    });
  };

  const handleApprovalResponse = async (ev: EventItem, status: "accepted" | "rejected") => {
    const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Member";

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
        } else {
          toast.info(`Schedule "${ev.title}" declined.`);
        }
        window.dispatchEvent(new Event("sika_schedule_updated"));
      }
    } catch {}
  };

  // Filter ketat semingguan: HANYA jadwal di mana user di-tag / creator, jadwal lewat atau ditolak disembunyikan
  const todayStr = getTodayFormatted();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = `${next7Days.getFullYear()}-${String(next7Days.getMonth() + 1).padStart(2, "0")}-${String(next7Days.getDate()).padStart(2, "0")}`;

  const weeklyUpcoming = [...events]
    .filter((ev) => ev.date >= todayStr && ev.date <= next7DaysStr)
    .filter((ev) => {
      if (!isUserTaggedOrCreator(ev)) return false;
      const currentUserName = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "You";
      const approvalsMap = (ev.approvals as Record<string, string>) || {};
      const myStatus = approvalsMap[currentUserName] || (user?.fullName ? approvalsMap[user.fullName] : undefined);
      if (myStatus === "rejected") return false;
      return true;
    })
    .sort((a, b) => (a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1)
    .slice(0, 6);

  return (
    <div className="w-full bg-[#121214] border border-[#222226] p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm tracking-wide text-white flex items-center gap-2 uppercase">
            <CalendarIcon size={16} className="text-zinc-400" /> Your Weekly Schedule
          </h3>
        </div>

        {/* Action Links */}
        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="bg-[#1a1a1e] border border-[#222226] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Open Calendar</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </Link>
        </div>
      </div>

      {/* Quick Add Event Form */}
      <form onSubmit={handleOpenModalWithQuickTitle} className="bg-[#161618] p-3 rounded-xl border border-[#222226] flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="New schedule title..."
          className="flex-1 px-3 py-2 bg-[#121214] border border-[#222226] rounded-lg text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          className="bg-white text-black font-semibold px-4 py-2 rounded-lg text-xs hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Event</span>
        </button>
      </form>

      {/* Scheduled Events List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            Weekly Schedule ({weeklyUpcoming.length})
          </h4>
          <Link href="/calendar" className="text-[11px] text-zinc-400 hover:text-white transition">
            View all calendars →
          </Link>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-xs text-zinc-500">Loading schedule...</div>
        ) : weeklyUpcoming.length === 0 ? (
          <div className="bg-[#161618]/60 border border-dashed border-[#222226] p-5 rounded-xl text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-zinc-600" />
            <span>No upcoming schedules for the next 7 days. Click "+ Add Event" to create one.</span>
          </div>
        ) : (
          weeklyUpcoming.map((ev) => {
            const assigneesList = ev.assignees && ev.assignees.length > 0 
              ? ev.assignees 
              : (ev.assignee ? [ev.assignee] : ["Team"]);
            const isOnline = ev.eventType !== "offline";
            const clientTheme = getClientThemeByName(ev.client, dbClients);

            return (
              <div
                key={ev.id}
                className="bg-[#161618] border border-[#222226] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-zinc-700 transition"
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white truncate">{ev.title}</span>
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

                  <div className="flex items-center gap-2 text-gray-400 text-[11px] flex-wrap">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-medium flex items-center gap-1 ${clientTheme.badge}`}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: clientTheme.dot }} />
                      <span>{ev.client}</span>
                    </span>
                    <span>•</span>
                    <span>{ev.date}</span>
                    {ev.time && <span>• {ev.time} WIB</span>}
                    {!isOnline && ev.location && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 truncate">{ev.location}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="bg-[#121214] text-gray-300 px-2.5 py-1 rounded-md border border-[#222226] flex items-center gap-1.5 font-medium text-[11px] max-w-[200px] truncate">
                    <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{assigneesList.join(", ")}</span>
                  </div>

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
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleApprovalResponse(ev, "accepted")}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] flex items-center gap-1 transition shadow cursor-pointer active:scale-95"
                            title="Accept schedule"
                          >
                            <Check size={10} />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprovalResponse(ev, "rejected")}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-400 text-[10px] flex items-center gap-1 transition cursor-pointer active:scale-95"
                            title="Decline schedule"
                          >
                            <X size={10} />
                            <span>Decline</span>
                          </button>
                        </div>
                      );
                    }

                    if (!isCreator && myStatus === "accepted") {
                      return (
                        <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1">
                          <Check size={10} />
                          <span>Accepted</span>
                        </span>
                      );
                    }

                    return null;
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FULL ADD SCHEDULE (Sama dengan Kalender) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-white" />
                <h3 className="text-sm font-bold text-white">Create Schedule Entry</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
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
                              toast.success(`Client "${res.client.name}" added successfully!`);
                            } else {
                              toast.error(res?.error || "Failed to create client");
                            }
                          } catch (e: any) {
                            toast.error("Failed to create client: " + e?.message);
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

              {/* Date & Time */}
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

              {/* Buttons */}
              <div className="flex items-center gap-2.5 pt-3">
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
                  {isSubmitting ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

