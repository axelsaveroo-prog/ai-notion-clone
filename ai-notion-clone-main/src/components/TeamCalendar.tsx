"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Trash2,
  CheckCircle2
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
  category?: "schedule" | "published_content" | string | null;
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
      } catch { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<UserMember[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);

  // State Modal Add Schedule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isModalOpen) {
      document.body.classList.add("modal-open");
      document.body.setAttribute("data-modal-open", "true");
      document.body.style.overflow = "hidden";
      window.dispatchEvent(new Event("sika_modal_change"));
    } else {
      document.body.classList.remove("modal-open");
      document.body.removeAttribute("data-modal-open");
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("sika_modal_change"));
    }
    return () => {
      document.body.classList.remove("modal-open");
      document.body.removeAttribute("data-modal-open");
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("sika_modal_change"));
    };
  }, [isModalOpen]);

  const [formCategory, setFormCategory] = useState<"schedule" | "published_content">("schedule");
  const [formTitle, setFormTitle] = useState("");
  const [formClient, setFormClient] = useState("AKASA LAND");
  const [formDate, setFormDate] = useState(getTodayFormatted());
  const [formTime, setFormTime] = useState("10:00");
  const [formAssignees, setFormAssignees] = useState<string[]>([creatorName]);
  const [formEventType, setFormEventType] = useState<"online" | "offline">("online");
  const [formMeetLink, setFormMeetLink] = useState("https://meet.google.com/new");
  const [formLocation, setFormLocation] = useState("");
  const [directToGCal, setDirectToGCal] = useState(false);
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
        } catch { }
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
    setFormCategory("schedule");
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

    // Validasi wajib diisi untuk link meeting atau lokasi HANYA jika opsi 1 (Jadwal biasa)
    if (formCategory === "schedule") {
      if (formEventType === "online" && !formMeetLink.trim()) {
        return;
      }
      if (formEventType === "offline" && !formLocation.trim()) {
        return;
      }
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
        meetLink: formCategory === "schedule" ? (formEventType === "online" ? formMeetLink.trim() : null) : (formMeetLink.trim() || null),
        location: formCategory === "schedule" ? (formEventType === "offline" ? formLocation.trim() : null) : null,
        creatorName: creatorName,
        category: formCategory,
      });

      if (res && res.success) {
        if (directToGCal && formCategory === "schedule") {
          toast.success("New schedule entry saved & opened in Google Calendar!");
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
        } else {
          toast.success("New schedule entry saved successfully!");
        }

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

  const isScheduleCreator = (ev: EventItem) => {
    if (!user) return false;
    const userIdentifiers = [
      user.id?.toLowerCase().trim(),
      user.fullName?.toLowerCase().trim(),
      user.firstName?.toLowerCase().trim(),
      user.lastName?.toLowerCase().trim(),
      user.username?.toLowerCase().trim(),
      user.primaryEmailAddress?.emailAddress?.toLowerCase().trim(),
      "you",
    ].filter(Boolean) as string[];

    if (!ev.creatorName) return false;
    const creator = ev.creatorName.toLowerCase().replace(/^@+/, "").trim();
    return userIdentifiers.some((id) => id === creator || creator.includes(id) || id.includes(creator));
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
    } catch { }
  };

  // Filter ketat semingguan: HANYA jadwal di mana user di-tag / creator, jadwal lewat atau ditolak disembunyikan
  const todayStr = getTodayFormatted();
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = `${next7Days.getFullYear()}-${String(next7Days.getMonth() + 1).padStart(2, "0")}-${String(next7Days.getDate()).padStart(2, "0")}`;

  const weeklyUpcoming = [...events]
    .filter((ev) => ev.date >= todayStr && ev.date <= next7DaysStr)
    .filter((ev) => ev.category !== "published_content")
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
                    const isCreator = isScheduleCreator(ev);
                    if (isCreator) return null; // Creator never gets confirmation/approval prompt

                    const approvalsMap = (ev.approvals as Record<string, string>) || {};
                    const myStatus = approvalsMap[currentUserName] || "pending";

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

      {/* MODAL FULL ADD SCHEDULE (English, Clean SaaS Design, Portaled to Body) */}
      {isModalOpen && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#141416] border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[85vh] sm:max-h-[88vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5 mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
                  <CalendarIcon size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {formCategory === "published_content" ? "Mark Published Content" : "Create Schedule Entry"}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {formCategory === "published_content" ? "Record live content published on social media" : "Plan a team or client meeting agenda"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              
              {/* Type Switcher: Schedule / Meeting vs Published Content */}
              <div className="grid grid-cols-2 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormCategory("schedule")}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                    formCategory === "schedule"
                      ? "bg-[#C65921] text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <CalendarIcon size={13} />
                  <span>Schedule / Meeting</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormCategory("published_content");
                    if (formMeetLink === "https://meet.google.com/new") setFormMeetLink("");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                    formCategory === "published_content"
                      ? "bg-[#C65921] text-white shadow-sm font-semibold"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>Published Content</span>
                </button>
              </div>

              {/* Title Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-400 font-medium">
                    {formCategory === "published_content" ? "Content Title" : "Event Title"} <span className="text-rose-400">*</span>
                  </label>
                </div>
                {formCategory === "published_content" && (
                  <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[10px] text-zinc-500 font-medium shrink-0">Format:</span>
                    {["Feeds", "Reels", "Story", "Carousel", "TikTok"].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          if (!formTitle.includes(`[${fmt}]`)) {
                            setFormTitle(`[${fmt}] ${formTitle.replace(/^\[[^\]]+\]\s*/, "")}`.trim());
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] border border-zinc-700/60 transition cursor-pointer shrink-0"
                      >
                        +{fmt}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={
                    formCategory === "published_content"
                      ? "e.g. [Reels] Brand Launch Video / Weekly Highlights"
                      : "e.g. Client Strategy Sync"
                  }
                  className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 text-xs"
                />
              </div>

              {/* Client Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-400 font-medium flex items-center gap-1">
                    <Tag size={12} /> Client
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
                      required
                      value={editClientModalName}
                      onChange={(e) => setEditClientModalName(e.target.value)}
                      placeholder="Client Name..."
                      className="w-full bg-[#121214] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                      {COLOR_OPTIONS_LIST.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setEditClientModalColor(c.name)}
                          className={`w-5 h-5 rounded-full border-2 transition ${
                            editClientModalColor === c.name ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.dot }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingClientModal(null)}
                        className="px-2.5 py-1 text-zinc-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUpdatingClientModal}
                        className="px-3 py-1 bg-white text-black font-semibold rounded-lg text-xs"
                      >
                        {isUpdatingClientModal ? "Updating..." : "Update"}
                      </button>
                    </div>
                  </form>
                ) : isAddingNewClientModal ? (
                  <form onSubmit={handleCreateClientModal} className="p-3 bg-[#18181b] border border-zinc-700/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white">Add New Client</span>
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
                      required
                      value={newClientModalName}
                      onChange={(e) => setNewClientModalName(e.target.value)}
                      placeholder="Client Name..."
                      className="w-full bg-[#121214] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                      {COLOR_OPTIONS_LIST.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setNewClientModalColor(c.name)}
                          className={`w-5 h-5 rounded-full border-2 transition ${
                            newClientModalColor === c.name ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.dot }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingNewClientModal(false)}
                        className="px-2.5 py-1 text-zinc-400 hover:text-white text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingClientModal}
                        className="px-3 py-1 bg-white text-black font-semibold rounded-lg text-xs"
                      >
                        {isSavingClientModal ? "Saving..." : "Save Client"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <select
                    value={formClient}
                    onChange={(e) => setFormClient(e.target.value)}
                    className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 text-xs"
                  >
                    {dbClients.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Team Members */}
              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                  <Users size={12} /> {formCategory === "published_content" ? "Assigned Team Members" : "Attendees"}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-[#18181b]/50 border border-zinc-800/80 rounded-xl">
                  {dbUsers
                    .filter((u) => u.name && u.name.trim() !== "")
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
              </div>

              {/* Conditional: Meeting Format vs Live Content Link */}
              {formCategory === "schedule" ? (
                <>
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
                            ? "bg-[#27272a] text-white border-zinc-600 shadow-xs"
                            : "bg-[#1c1c1f] text-zinc-400 border-zinc-800 hover:text-zinc-200"
                        }`}
                      >
                        <MapPin size={13} />
                        <span>In-Person Meeting</span>
                      </button>
                    </div>
                  </div>

                  {formEventType === "online" ? (
                    <div>
                      <label className="block text-zinc-400 mb-1.5 font-medium flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Video size={12} className="text-zinc-400" /> Meeting Link (Google Meet / Zoom) <span className="text-zinc-500">*</span>
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
                </>
              ) : (
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                    <ExternalLink size={12} className="text-zinc-400" /> Live URL or Drive Asset Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={formMeetLink === "https://meet.google.com/new" ? "" : formMeetLink}
                    onChange={(e) => setFormMeetLink(e.target.value)}
                    placeholder="https://instagram.com/p/... or Google Drive asset link"
                    className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 text-xs transition"
                  />
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-medium flex items-center gap-1">
                    <CalendarIcon size={12} /> {formCategory === "published_content" ? "Publish Date" : "Date"}
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
                    className="w-full bg-[#1c1c1f] border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-zinc-600 text-xs"
                  />
                </div>
              </div>

              {/* Sync to Google Calendar */}
              {formCategory === "schedule" && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#1c1c1f] border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition select-none">
                  <input
                    type="checkbox"
                    checked={directToGCal}
                    onChange={(e) => setDirectToGCal(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C65921] accent-[#C65921] cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <ExternalLink size={13} className="text-[#C65921]" />
                    <span>Sync to Google Calendar after saving</span>
                  </div>
                </label>
              )}

              {/* Action Buttons: Sticky inside the card */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-center gap-2.5 shrink-0 bg-[#141416]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition font-medium cursor-pointer text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold transition shadow cursor-pointer disabled:opacity-50 text-xs"
                >
                  {isSubmitting
                    ? "Saving..."
                    : formCategory === "published_content"
                    ? "Save Published Content"
                    : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
