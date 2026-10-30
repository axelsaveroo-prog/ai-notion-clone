"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Loader2, 
  Check, 
  Folder, 
  FolderOpen, 
  ArrowLeft, 
  Filter, 
  User as UserIcon, 
  Users, 
  Bookmark, 
  Search, 
  ExternalLink, 
  FileText, 
  Link as LinkIcon, 
  Clock, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Pencil, 
  Share2, 
  Menu, 
  X,
  Sparkles,
  HelpCircle,
  FileCheck2,
  Layers
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  getTasksAction, 
  createTaskAction, 
  updateTaskStatusAction, 
  deleteTaskAction,
  getUsersAction,
  getClientsAction,
  createClientAction,
  getCalendarEvents
} from "@/actions/actions";
import { getClientThemeByName, COLOR_OPTIONS_LIST } from "@/lib/client-colors";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface Task {
  id: string;
  title: string;
  client: string;
  type?: string | null;
  status: string;
  assignedBy?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
  createdAt?: string | Date;
}

interface DbClient {
  id: string;
  name: string;
  color: string;
}

interface CalendarEventItem {
  id: string;
  title: string;
  client: string;
  date: string;
  time?: string;
  meetLink?: string | null;
}

// Notion Card Type Pill Styling (Soft Luxury Palette)
const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Reels: { bg: "bg-[#27211e]", text: "text-[#e6bca6]", border: "border-[#45332a]" },
  Feeds: { bg: "bg-[#182322]", text: "text-[#a2dcd4]", border: "border-[#25423f]" },
  Story: { bg: "bg-[#231f28]", text: "text-[#d7c4ea]", border: "border-[#3f3150]" },
  Carousel: { bg: "bg-[#1c2420]", text: "text-[#b2dfc8]", border: "border-[#2c4739]" },
  Others: { bg: "bg-[#202023]", text: "text-[#c2c2c9]", border: "border-[#34343a]" },
};

export function TasksManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Navigasi View: 'my_tasks' | 'all_tasks' | '<ClientName>'
  const initialClientQuery = searchParams.get("client");
  const [selectedView, setSelectedView] = useState<string>(initialClientQuery || "my_tasks");

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Search & Filter
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");

  // Modal Tambah Client Baru
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientColor, setNewClientColor] = useState("sky");
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Client Drive Link Modal
  const [isEditDriveLinkOpen, setIsEditDriveLinkOpen] = useState(false);
  const [driveLinkInput, setDriveLinkInput] = useState("");

  // State Drag and Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Sinkronisasi query param ke state
  useEffect(() => {
    const clientParam = searchParams.get("client");
    if (clientParam) {
      setSelectedView(clientParam);
    }
  }, [searchParams]);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [tasksData, usersData, clientsData, eventsData] = await Promise.all([
        getTasksAction(),
        getUsersAction(),
        getClientsAction(),
        getCalendarEvents(),
      ]);

      if (tasksData && Array.isArray(tasksData)) {
        setTasks(tasksData);
      }
      if (usersData && Array.isArray(usersData)) {
        setAvailableUsers(usersData);
      }
      if (clientsData && Array.isArray(clientsData)) {
        setDbClients(clientsData);
      }
      if (eventsData && Array.isArray(eventsData)) {
        setCalendarEvents(eventsData as any);
      }
    } catch (e) {
      console.error("Gagal memuat task:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cek apakah tugas ditujukan / men-tag user saat ini
  const isTaskForCurrentUser = useCallback((t: Task) => {
    if (!user) return true;
    const userIdentifiers = [
      user.fullName?.toLowerCase().trim(),
      user.firstName?.toLowerCase().trim(),
      user.username?.toLowerCase().trim(),
      user.primaryEmailAddress?.emailAddress?.toLowerCase().trim(),
      "you",
      "team",
      "all",
    ].filter(Boolean) as string[];

    if (t.assignedBy) {
      const creator = t.assignedBy.toLowerCase().trim();
      if (userIdentifiers.some((id) => id === creator || creator.includes(id))) return true;
    }

    if (t.assignee) {
      const parts = t.assignee.split(",").map((p) => p.trim().toLowerCase());
      if (parts.some((p) => userIdentifiers.some((id) => id === p || p === "you" || p === "all" || p === "team"))) {
        return true;
      }
    }
    return false;
  }, [user]);

  // Daftar client dinamis (dari DB dan tasks)
  const clientList = useMemo(() => {
    const names = new Set<string>();
    dbClients.forEach((c) => {
      if (c.name && c.name.trim() && c.name !== "General") {
        names.add(c.name.trim());
      }
    });
    tasks.forEach((t) => {
      if (t.client && t.client.trim() && t.client !== "General") {
        names.add(t.client.trim());
      }
    });
    return Array.from(names).sort();
  }, [dbClients, tasks]);

  // Switcher View Handler
  const handleSelectView = (view: string) => {
    setSelectedView(view);
    setIsMobileSidebarOpen(false);
    setTaskSearchQuery("");
    setSelectedTypeFilter("ALL");

    // Update URL agar bisa di-share atau refresh
    if (view === "my_tasks") {
      router.replace("/tasks");
    } else if (view === "all_tasks") {
      router.replace("/tasks?view=all");
    } else {
      router.replace(`/tasks?client=${encodeURIComponent(view)}`);
    }
  };

  // Apakah sedang di dalam Client Page
  const isClientPage = selectedView !== "my_tasks" && selectedView !== "all_tasks";
  const activeClientName = isClientPage ? selectedView : "";
  const activeClientTheme = getClientThemeByName(activeClientName, dbClients);

  // Tasks dihitung sesuai view:
  // 1. my_tasks: hanya tugas user ini
  // 2. all_tasks: semua tugas tim
  // 3. Client Page: SEMUA tugas client tersebut (siapapun bisa lihat tanpa filter tag)
  const displayedTasks = useMemo(() => {
    let result = tasks;

    if (isClientPage) {
      // PENTING: Untuk client page, SEMUA orang bisa lihat brief client ini (tidak difilter tag)
      result = result.filter((t) => t.client.toLowerCase() === activeClientName.toLowerCase());
    } else if (selectedView === "my_tasks") {
      result = result.filter(isTaskForCurrentUser);
    } // else all_tasks: all

    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.client.toLowerCase().includes(q) ||
          (t.assignee && t.assignee.toLowerCase().includes(q))
      );
    }

    if (selectedTypeFilter !== "ALL") {
      result = result.filter((t) => (t.type || "Feeds") === selectedTypeFilter);
    }

    return result;
  }, [tasks, isClientPage, activeClientName, selectedView, isTaskForCurrentUser, taskSearchQuery, selectedTypeFilter]);

  // MoM / Agenda pertemuan untuk client aktif
  const clientMeetingNotes = useMemo(() => {
    if (!isClientPage) return [];
    return calendarEvents.filter(
      (ev) => ev.client && ev.client.toLowerCase() === activeClientName.toLowerCase()
    );
  }, [isClientPage, calendarEvents, activeClientName]);

  // Drive link per client (localStorage persistent)
  const clientDriveLink = useMemo(() => {
    if (!isClientPage || typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(`SIKA_CLIENT_DRIVE_${activeClientName}`);
      if (saved) return saved;
    } catch {}
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(activeClientName)}`;
  }, [isClientPage, activeClientName]);

  const handleSaveDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientName) return;
    try {
      localStorage.setItem(`SIKA_CLIENT_DRIVE_${activeClientName}`, driveLinkInput.trim());
      toast.success("Google Drive Link client berhasil diperbarui!");
      setIsEditDriveLinkOpen(false);
    } catch {
      toast.error("Gagal menyimpan link");
    }
  };

  // Buat new task ala Notion: langsung pre-fill client & buka editor brief
  const handleCreateNewTask = async (prefilledClient?: string, prefilledStatus?: string) => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const defaultAssignee = user?.fullName || availableUsers[0]?.name || "You";
      const targetClient = prefilledClient || (isClientPage ? activeClientName : clientList[0] || "General");
      const targetStatus = prefilledStatus || "todo";

      const res = await createTaskAction({
        title: "Untitled Task",
        status: targetStatus,
        client: targetClient,
        type: "Feeds",
        assignee: defaultAssignee,
        brief: "",
      });

      if (res && res.success && res.task) {
        toast.success("Brief baru dibuat! Membuka editor...");
        router.push(`/tasks/${res.task.id}`);
      } else {
        toast.error("Gagal membuat task: " + (res?.error || "Error database"));
        setIsCreating(false);
      }
    } catch {
      toast.error("Gagal membuat task baru");
      setIsCreating(false);
    }
  };

  // Tambah Client Baru
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClientName.trim();
    if (!trimmed) {
      toast.error("Nama client tidak boleh kosong");
      return;
    }

    setIsSavingClient(true);
    try {
      const res = await createClientAction({
        name: trimmed,
        color: newClientColor,
      });

      if (res && res.success && res.client) {
        toast.success(`Client "${res.client.name}" berhasil ditambahkan!`);
        setDbClients((prev) => [...prev, res.client!]);
        setIsAddClientModalOpen(false);
        setNewClientName("");
        handleSelectView(res.client.name);
      } else {
        toast.error(res?.error || "Gagal membuat client");
      }
    } catch (e: any) {
      toast.error("Gagal membuat client: " + e?.message);
    } finally {
      setIsSavingClient(false);
    }
  };

  // Update Status / Move Task
  const moveTask = async (id: string, newStatus: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    try {
      await updateTaskStatusAction(id, newStatus);
    } catch {
      loadData();
    }
  };

  // Handler Drag and Drop
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colKey: string) => {
    if (dragOverCol === colKey) {
      setDragOverCol(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDragOverCol(null);
    setDraggedTaskId(null);

    if (!taskId) return;
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    await moveTask(taskId, newStatus);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTaskAction(id);
      toast.success("Task dihapus");
    } catch {
      loadData();
    }
  };

  // =========================================================
  // DEFINISI KOLOM KANBAN
  // =========================================================
  // Untuk Client Page (Notion Progress Board): 5 Kolom ala Notion
  const notionColumns = [
    { 
      key: "todo", 
      label: "NO STATUS / TO DO", 
      filter: (s: string) => s === "todo" || s === "no_status" || !s,
      dotColor: "#71717a"
    },
    { 
      key: "brief_ready", 
      label: "BRIEF READY", 
      filter: (s: string) => s.toLowerCase().includes("brief"),
      dotColor: "#f59e0b"
    },
    { 
      key: "editing", 
      label: "EDITING / PROGRESS", 
      filter: (s: string) => s === "in_progress" || s.toLowerCase().includes("edit"),
      dotColor: "#38bdf8"
    },
    { 
      key: "revisi", 
      label: "REVISI", 
      filter: (s: string) => s.toLowerCase().includes("revisi"),
      dotColor: "#fb7185"
    },
    { 
      key: "done", 
      label: "READY TO UPLOAD / DONE", 
      filter: (s: string) => s === "done" || s.toLowerCase().includes("ready") || s.toLowerCase().includes("scheduled"),
      dotColor: "#34d399"
    },
  ];

  // Untuk General Task Operations: 3 Kolom Standar
  const standardColumns = [
    { key: "todo", label: "TO DO", filter: (s: string) => s === "todo" || !s || s === "Brief Ready", dotColor: "#71717a" },
    { key: "in_progress", label: "IN PROGRESS", filter: (s: string) => s === "in_progress" || s.toLowerCase().includes("edit") || s.toLowerCase().includes("revisi"), dotColor: "#38bdf8" },
    { key: "done", label: "DONE", filter: (s: string) => s === "done" || s.toLowerCase().includes("ready"), dotColor: "#34d399" },
  ];

  const currentColumns = isClientPage ? notionColumns : standardColumns;

  return (
    <div className="w-full flex flex-col lg:flex-row items-start gap-5 relative">
      
      {/* ========================================================= */}
      {/* 1. SIDEBAR KIRI: NOTION-STYLE CLIENT FOLDERS & NAVIGATION */}
      {/* ========================================================= */}
      
      {/* Mobile Sidebar Toggle Button */}
      <div className="lg:hidden w-full flex items-center justify-between bg-[#141416] border border-zinc-800 p-3 rounded-xl mb-1">
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex items-center gap-2 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition"
        >
          <Menu size={15} />
          <span>Buka Folder Client ({clientList.length})</span>
        </button>

        <span className="text-xs text-zinc-400 font-medium">
          {isClientPage ? `📁 ${activeClientName}` : (selectedView === "my_tasks" ? "👤 Tugas Saya" : "📋 Semua Brief")}
        </span>
      </div>

      {/* Backdrop Mobile Drawer */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-xs animate-in fade-in"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-auto
          w-72 lg:w-64 bg-[#121214] border-r lg:border border-[#222226] lg:rounded-2xl
          p-4 flex flex-col gap-4 shadow-xl lg:shadow-sm shrink-0 transition-transform duration-200
          overflow-y-auto no-scrollbar
          ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Workspace Brand Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#27272a] border border-zinc-700 flex items-center justify-center text-amber-500 font-bold text-xs shadow-xs">
              <Bookmark size={14} className="fill-current" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight leading-tight">Sika Creative HQ</h3>
              <p className="text-[10px] text-zinc-400">Task Operations</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Views (Tugas Saya & Semua Tugas) */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1">
            General Views
          </div>

          <button
            type="button"
            onClick={() => handleSelectView("my_tasks")}
            className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between ${
              selectedView === "my_tasks"
                ? "bg-[#252529] text-white border border-zinc-700 shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <UserIcon size={14} className={selectedView === "my_tasks" ? "text-amber-400" : "text-zinc-400"} />
              <span>Tugas Saya</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              {tasks.filter(isTaskForCurrentUser).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectView("all_tasks")}
            className={`w-full px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between ${
              selectedView === "all_tasks"
                ? "bg-[#252529] text-white border border-zinc-700 shadow-xs"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={14} className={selectedView === "all_tasks" ? "text-amber-400" : "text-zinc-400"} />
              <span>Semua Brief Tim</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              {tasks.length}
            </span>
          </button>
        </div>

        <div className="border-t border-zinc-800/70 pt-3 flex flex-col gap-2">
          {/* Section Header: Client Pages */}
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Client Pages ({clientList.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddClientModalOpen(true)}
              className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-0.5 bg-zinc-800/80 hover:bg-zinc-700 px-1.5 py-0.5 rounded transition cursor-pointer"
              title="Tambah Client Baru"
            >
              <Plus size={11} />
              <span>Client</span>
            </button>
          </div>

          {/* List Client Folders */}
          <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto no-scrollbar">
            {clientList.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-zinc-500 italic">
                Belum ada client folder
              </div>
            ) : (
              clientList.map((clientName) => {
                const isSelected = selectedView === clientName;
                const clientTasksCount = tasks.filter((t) => t.client.toLowerCase() === clientName.toLowerCase()).length;
                const theme = getClientThemeByName(clientName, dbClients);

                return (
                  <button
                    key={clientName}
                    type="button"
                    onClick={() => handleSelectView(clientName)}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-between text-left group ${
                      isSelected
                        ? "bg-[#252529] text-white border border-zinc-700 font-semibold shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 mr-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: theme.dot }}
                      />
                      <span className="truncate">{clientName}</span>
                    </div>

                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono shrink-0 group-hover:text-zinc-200">
                      {clientTasksCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Helper Info */}
        <div className="mt-auto pt-4 border-t border-zinc-800/70 text-[10px] text-zinc-500 leading-relaxed">
          Semua brief di folder client dapat dilihat bersama oleh seluruh tim.
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. AREA UTAMA: NOTION WORKSPACE PAGE ATAU GENERAL VIEW   */}
      {/* ========================================================= */}
      <main className="flex-1 w-full min-w-0 flex flex-col gap-5">
        
        {/* ======================================================= */}
        {/* VIEW A: NOTION CLIENT WORKSPACE PORTAL (SEPERTI GAMBAR) */}
        {/* ======================================================= */}
        {isClientPage ? (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            
            {/* Top Breadcrumbs Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-zinc-400 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-zinc-500">Sika Creative HQ</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">Client Pages</span>
                <span className="text-zinc-600">/</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Bookmark size={13} className="text-amber-500" />
                  <span>{activeClientName}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectView("all_tasks")}
                  className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>Semua Brief</span>
                </button>
              </div>
            </div>

            {/* Notion Page Banner & Header */}
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-2xl bg-[#1e1e22] border border-zinc-700/80 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                  <Bookmark size={28} className="fill-current" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
                      {activeClientName}
                    </h1>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${activeClientTheme.badge}`}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeClientTheme.dot }} />
                      <span>Client Portal</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mt-1">
                    {displayedTasks.length} task briefs terdaftar • Terbuka untuk seluruh tim
                  </p>
                </div>

                {/* "+ New Task in Client" Button */}
                <button
                  onClick={() => handleCreateNewTask(activeClientName)}
                  disabled={isCreating}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 ml-auto"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membuat Brief...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>New Task in {activeClientName}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Description Box (Sama persis seperti Notion pada screenshot user) */}
              <div className="bg-[#141417] border border-[#222226] p-4 rounded-2xl text-xs leading-relaxed text-zinc-300 space-y-2">
                <p className="font-semibold text-white">Welcome to your portal, {activeClientName}!</p>
                <p className="text-zinc-400">
                  This is a shared workspace to store meeting minutes, project details, link to files/assets.
                </p>
                <p className="text-zinc-400">
                  At the bottom of this page, you&apos;ll see a &quot;Progress Board&quot;, where we track what we&apos;re looking on.
                </p>
                <p className="text-zinc-400">
                  Feel free to contact us if you have any questions.
                </p>
                <p className="font-semibold text-amber-500/90 pt-1 font-mono text-[11px]">#BetterWithSika</p>
              </div>
            </div>

            {/* Notion Quick Sections (LINKS, NOTES, FILES - persis layout Notion) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* 1. LINKS SECTION */}
              <div className="bg-[#141416] border border-[#222226] p-4 rounded-2xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <LinkIcon size={13} className="text-sky-400" />
                    <span>LINKS</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setDriveLinkInput(clientDriveLink);
                      setIsEditDriveLinkOpen(true);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition"
                  >
                    <Pencil size={11} />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="space-y-1.5 flex-1">
                  <a
                    href={clientDriveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-[#1a1a1e] hover:bg-[#222228] border border-zinc-800 text-xs text-white transition flex items-center justify-between group"
                  >
                    <span className="font-semibold truncate text-[11px]">
                      📁 {activeClientName} - DRIVE LINK
                    </span>
                    <ExternalLink size={12} className="text-zinc-500 group-hover:text-white shrink-0 ml-1.5" />
                  </a>

                  <p className="text-[10px] text-zinc-500 px-1 pt-1">
                    Gunakan link ini untuk mengakses Google Drive aset project {activeClientName}.
                  </p>
                </div>
              </div>

              {/* 2. NOTES / MOM SECTION */}
              <div className="bg-[#141416] border border-[#222226] p-4 rounded-2xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-400" />
                    <span>NOTES & MOM</span>
                  </h4>
                  <Link
                    href="/calendar"
                    className="text-[10px] text-zinc-500 hover:text-white transition"
                  >
                    + Kalender
                  </Link>
                </div>

                <div className="space-y-1.5 flex-1 max-h-36 overflow-y-auto no-scrollbar">
                  {clientMeetingNotes.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#1a1a1e] border border-zinc-800/80 text-[11px] text-zinc-500 italic">
                      Belum ada notulen MoM tercatat untuk {activeClientName}.
                    </div>
                  ) : (
                    clientMeetingNotes.map((m) => (
                      <Link
                        key={m.id}
                        href={`/mom/${m.id}`}
                        className="p-2 rounded-xl bg-[#1a1a1e] hover:bg-[#222228] border border-zinc-800 text-xs text-zinc-200 transition flex items-center justify-between group block"
                      >
                        <div className="truncate mr-1">
                          <span className="font-medium text-white block truncate text-[11px] group-hover:text-amber-400">
                            👥 {m.title}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono block">
                            {m.date} {m.time ? `• ${m.time} WIB` : ""}
                          </span>
                        </div>
                        <ChevronRight size={12} className="text-zinc-500 group-hover:text-white shrink-0" />
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* 3. FILES / GUIDELINES SECTION */}
              <div className="bg-[#141416] border border-[#222226] p-4 rounded-2xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <FileCheck2 size={13} className="text-emerald-400" />
                    <span>GUIDELINES & ASSETS</span>
                  </h4>
                </div>

                <div className="space-y-1.5 flex-1 text-xs text-zinc-400">
                  <div className="p-2.5 rounded-xl bg-[#1a1a1e] border border-zinc-800 space-y-1">
                    <span className="text-[11px] font-semibold text-white block">📌 Brand Guidelines</span>
                    <p className="text-[10px] text-zinc-400">
                      Standard visual, typography, tone of voice, dan format brief untuk {activeClientName}.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Notion Board Header & Filter */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <Layers size={16} className="text-amber-500" />
                  <span>PROGRESS BOARD</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                  {displayedTasks.length} Cards
                </span>
              </div>

              {/* Filter Type (Feeds, Story, Reels, Carousel) & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#161619] p-1 rounded-xl border border-zinc-800 text-[11px]">
                  {["ALL", "Feeds", "Story", "Reels", "Carousel"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTypeFilter(t)}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer font-medium ${
                        selectedTypeFilter === t
                          ? "bg-zinc-700 text-white shadow-xs"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-zinc-500" />
                  <input
                    type="text"
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder="Search brief..."
                    className="w-36 sm:w-44 bg-[#141416] border border-zinc-800 rounded-xl pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            </div>

          </div>
        ) : (
          
          /* ======================================================= */
          /* VIEW B: GENERAL TASK OPERATIONS (TUGAS SAYA / TIM)      */
          /* ======================================================= */
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Header General */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {selectedView === "my_tasks" ? "Tugas Saya" : "Semua Brief Tim"}
                </h1>
                <p className="text-xs text-zinc-400 mt-1">
                  {selectedView === "my_tasks" 
                    ? "Menampilkan brief yang men-tag Anda atau dibuat oleh Anda." 
                    : "Menampilkan semua brief operasional kantor seluruh tim."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCreateNewTask()}
                  disabled={isCreating}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membuat Brief...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>New Task</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Search */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="text-xs text-zinc-400">
                Total brief: <span className="font-semibold text-white font-mono">{displayedTasks.length}</span>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-zinc-500" />
                <input
                  type="text"
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder="Cari brief atau assignee..."
                  className="w-48 sm:w-64 bg-[#141416] border border-zinc-800 rounded-xl pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. KANBAN PROGRESS BOARD (HORIZONTAL COLUMNS)             */}
        {/* ========================================================= */}
        <div className={`grid grid-cols-1 ${isClientPage ? "sm:grid-cols-2 lg:grid-cols-5" : "md:grid-cols-3"} gap-3.5 items-start`}>
          {currentColumns.map((col) => {
            const colTasks = displayedTasks.filter((t) => col.filter(t.status || ""));
            const isOver = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={(e) => handleDragLeave(e, col.key)}
                onDrop={(e) => handleDrop(e, col.key)}
                className={`bg-[#121214] p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 shadow-sm min-h-[360px] ${
                  isOver 
                    ? "border-zinc-500/70 bg-[#161619] ring-1 ring-zinc-500/30 scale-[1.005]" 
                    : "border-[#222226]"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: col.dotColor }} 
                    />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 truncate">
                      {col.label}
                    </h4>
                  </div>
                  <span className="text-[10px] bg-[#1a1a1e] text-zinc-400 px-1.5 py-0.5 rounded font-mono font-medium border border-[#27272a]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-2 flex-1">
                  {colTasks.length === 0 ? (
                    <div className={`py-10 text-center text-[11px] text-zinc-600 italic border border-dashed rounded-xl transition ${
                      isOver ? "border-zinc-500/60 bg-zinc-800/30 text-zinc-300" : "border-zinc-800/40"
                    }`}>
                      {isOver ? "Lepaskan di sini" : "Kosong"}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isBeingDragged = draggedTaskId === task.id;
                      const taskType = task.type || "Feeds";
                      const typeStyle = TYPE_STYLES[taskType] || TYPE_STYLES.Others;
                      const theme = getClientThemeByName(task.client, dbClients);

                      return (
                        <div
                          key={task.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          className={`bg-[#17171a] p-3 rounded-xl border shadow-sm flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing select-none group ${
                            isBeingDragged
                              ? "opacity-40 border-dashed border-zinc-500 scale-[0.99]"
                              : "border-[#242428] hover:border-zinc-600 hover:bg-[#1a1a1e]"
                          }`}
                        >
                          {/* Card Header: Type Tag & Grip */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 truncate">
                              <GripVertical size={12} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 cursor-grab" />
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                {taskType}
                              </span>

                              {/* Tampilkan client tag jika sedang di General View */}
                              {!isClientPage && (
                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border truncate ${theme.badge}`}>
                                  {task.client}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              title="Hapus Task"
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          {/* Title Link to Brief Editor */}
                          <Link 
                            href={`/tasks/${task.id}`}
                            className="hover:underline cursor-pointer"
                          >
                            <p className="text-xs font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors line-clamp-2">
                              {task.title || "Untitled Task"}
                            </p>
                          </Link>

                          {/* Assignee & Due Date */}
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 flex-wrap gap-1">
                            {task.assignee ? (
                              <div className="flex items-center gap-1 truncate max-w-[130px]">
                                <span className="text-zinc-300 font-medium truncate">
                                  @{task.assignee.split(",")[0]?.trim()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600">Unassigned</span>
                            )}

                            {task.dueDate && (
                              <span className="text-[9px] text-zinc-400 font-mono">
                                {task.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* + New Task at Bottom of Column */}
                <button
                  type="button"
                  onClick={() => handleCreateNewTask(isClientPage ? activeClientName : undefined, col.key)}
                  className="w-full py-1.5 rounded-lg border border-dashed border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>New page</span>
                </button>
              </div>
            );
          })}
        </div>

      </main>

      {/* ========================================================= */}
      {/* 4. MODAL TAMBAH CLIENT BARU                               */}
      {/* ========================================================= */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Bookmark size={15} className="text-amber-500" />
                <span>Tambah Client Folder Baru</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClientModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Nama Client (Folder)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: AKASA LAND, APERIO"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                  Warna Tema Folder
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS_LIST.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setNewClientColor(c.key)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer ${
                        newClientColor === c.key ? "ring-2 ring-white scale-110" : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.dot }}
                      title={c.label}
                    >
                      {newClientColor === c.key && <Check size={11} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingClient ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  <span>Buat Folder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL EDIT GOOGLE DRIVE LINK                           */}
      {/* ========================================================= */}
      {isEditDriveLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#18181c] border border-zinc-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <LinkIcon size={15} className="text-sky-400" />
                <span>Link Google Drive {activeClientName}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDriveLinkOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveDriveLink} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  URL Google Drive Folder
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveLinkInput}
                  onChange={(e) => setDriveLinkInput(e.target.value)}
                  className="w-full bg-[#131316] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsEditDriveLinkOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition"
                >
                  Simpan Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
