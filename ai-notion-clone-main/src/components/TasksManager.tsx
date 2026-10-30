"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, GripVertical, Loader2, Check, Folder, FolderOpen, ArrowLeft, Filter, User as UserIcon, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  getTasksAction, 
  createTaskAction, 
  updateTaskStatusAction, 
  deleteTaskAction,
  getUsersAction,
  getClientsAction
} from "@/actions/actions";
import { getClientThemeByName } from "@/lib/client-colors";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

interface Task {
  id: string;
  title: string;
  client: string;
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

export function TasksManager() {
  const router = useRouter();
  const { user } = useUser();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string }[]>([]);

  // Filter Client / Foldering
  const [selectedClientFilter, setSelectedClientFilter] = useState("ALL");
  // Filter Scope: hanya tugas saya (tagged) vs semua tugas tim
  const [scopeFilter, setScopeFilter] = useState<"my_tasks" | "all">("my_tasks");

  // State Drag and Drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasksData, usersData, clientsData] = await Promise.all([
        getTasksAction(),
        getUsersAction(),
        getClientsAction(),
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

  // Filter tasks sesuai scope (default: hanya tugas user yang ditag)
  const scopedTasks = useMemo(() => {
    if (scopeFilter === "all") return tasks;
    return tasks.filter(isTaskForCurrentUser);
  }, [tasks, scopeFilter, isTaskForCurrentUser]);

  // Tab filter client dinamis: diambil dari database clients dan tasks
  const dynamicClients = useMemo(() => {
    const clients = new Set<string>();
    dbClients.forEach((c) => {
      if (c.name && c.name.trim() && c.name !== "General") {
        clients.add(c.name.trim());
      }
    });
    tasks.forEach((t) => {
      if (t.client && t.client.trim() && t.client !== "General") {
        clients.add(t.client.trim());
      }
    });
    return Array.from(clients).sort();
  }, [dbClients, tasks]);

  // Folder data untuk UI foldering per client
  const clientFolders = useMemo(() => {
    return dynamicClients.map((clientName) => {
      const clientTasks = scopedTasks.filter((t) => t.client === clientName);
      const theme = getClientThemeByName(clientName, dbClients);
      return {
        name: clientName,
        taskCount: clientTasks.length,
        pendingCount: clientTasks.filter((t) => t.status !== "done").length,
        theme,
      };
    });
  }, [dynamicClients, scopedTasks, dbClients]);

  // Buat new task ala Notion: klik tombol -> buat draft kosongan -> langsung buka halaman brief
  const handleCreateNewTask = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const defaultAssignee = user?.fullName || availableUsers[0]?.name || "You";
      const defaultClient = selectedClientFilter !== "ALL" ? selectedClientFilter : (dynamicClients[0] || "General");

      const res = await createTaskAction({
        title: "Untitled Task",
        status: "todo",
        client: defaultClient,
        assignee: defaultAssignee,
        brief: "",
      });

      if (res && res.success && res.task) {
        toast.success("Brief baru dibuat! Membuka halaman brief...");
        router.push(`/tasks/${res.task.id}`);
      } else {
        toast.error("Gagal membuat task: " + (res?.error || "Error database"));
        setIsCreating(false);
      }
    } catch (e: any) {
      toast.error("Gagal membuat task baru");
      setIsCreating(false);
    }
  };

  // Pindah kolom / update status
  const moveTask = async (id: string, newStatus: "todo" | "in_progress" | "done") => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    try {
      await updateTaskStatusAction(id, newStatus);
    } catch (e) {
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

  const handleDrop = async (e: React.DragEvent, newStatus: "todo" | "in_progress" | "done") => {
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
    } catch (e) {
      loadData();
    }
  };

  const filteredTasks = selectedClientFilter === "ALL" 
    ? scopedTasks 
    : scopedTasks.filter((t) => t.client === selectedClientFilter);

  const columns: { key: "todo" | "in_progress" | "done"; label: string }[] = [
    { key: "todo", label: "TO DO" },
    { key: "in_progress", label: "IN PROGRESS" },
    { key: "done", label: "DONE" },
  ];

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* ========================================================= */}
      {/* 1. CLIENT FOLDERS HUB (FOLDERING PER CLIENT)              */}
      {/* ========================================================= */}
      <div className="bg-[#121214] border border-[#222226] p-4 rounded-2xl shadow-sm flex flex-col gap-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-500/90" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Client Folders</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              {clientFolders.length} Folders
            </span>
          </div>

          {/* Toggle: Tugas Saya (Tagged) vs Semua Tugas Tim */}
          <div className="flex items-center gap-1 bg-[#18181c] p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setScopeFilter("my_tasks")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                scopeFilter === "my_tasks"
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <UserIcon size={12} />
              <span>Tugas Saya</span>
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                scopeFilter === "all"
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Users size={12} />
              <span>Semua Tugas</span>
            </button>
          </div>
        </div>

        {/* Grid Folder Kartu per Client */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {/* Card: All Folders */}
          <button
            type="button"
            onClick={() => setSelectedClientFilter("ALL")}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
              selectedClientFilter === "ALL"
                ? "bg-[#27272a] border-zinc-500 shadow-md ring-1 ring-zinc-500/30"
                : "bg-[#18181c] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#202024]"
            }`}
          >
            <div className="flex items-center justify-between">
              {selectedClientFilter === "ALL" ? (
                <FolderOpen className="w-5 h-5 text-zinc-200" />
              ) : (
                <Folder className="w-5 h-5 text-zinc-400" />
              )}
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                {scopedTasks.length}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white truncate">All Folders</p>
              <p className="text-[10px] text-zinc-400">Semua brief</p>
            </div>
          </button>

          {/* Cards per Client */}
          {clientFolders.map((folder) => {
            const isSelected = selectedClientFilter === folder.name;
            return (
              <button
                key={folder.name}
                type="button"
                onClick={() => setSelectedClientFilter(folder.name)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 group ${
                  isSelected
                    ? "bg-[#27272a] border-zinc-400 shadow-md ring-1 ring-zinc-400/40"
                    : "bg-[#18181c] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#202024]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="relative">
                    {isSelected ? (
                      <FolderOpen className="w-5 h-5" style={{ color: folder.theme.dot }} />
                    ) : (
                      <Folder className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200" />
                    )}
                    <span 
                      className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" 
                      style={{ backgroundColor: folder.theme.dot }} 
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
                    {folder.taskCount}
                  </span>
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{folder.name}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {folder.pendingCount > 0 ? `${folder.pendingCount} pending` : "Done"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ACTIVE FOLDER BAR & "+ NEW TASK" BUTTON                */}
      {/* ========================================================= */}
      <div className="bg-[#121214] border border-[#222226] p-4 rounded-2xl shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-zinc-400 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-500">Folder:</span>
            <span className="font-semibold text-white">
              {selectedClientFilter === "ALL" ? "All Client Folders" : selectedClientFilter}
            </span>
          </span>

          {selectedClientFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedClientFilter("ALL")}
              className="text-[11px] text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700 hover:bg-zinc-800 transition cursor-pointer"
            >
              ← Lihat Semua Folder
            </button>
          )}

          <span className="text-[10px] text-zinc-500 font-mono ml-1">
            ({filteredTasks.length} task brief)
          </span>
        </div>

        {/* Notion-style "+ New Task" Button */}
        <button
          onClick={handleCreateNewTask}
          disabled={isCreating}
          className="bg-zinc-200 hover:bg-white text-zinc-900 font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 ml-auto"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-700" />
              <span>Membuat Brief...</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 text-zinc-800" />
              <span>New Task {selectedClientFilter !== "ALL" ? `in ${selectedClientFilter}` : ""}</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. KANBAN GRID WITH DRAG & DROP                           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.key);
          const isOver = dragOverCol === col.key;

          return (
            <div 
              key={col.key} 
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={(e) => handleDragLeave(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`bg-[#121214] p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 shadow-sm min-h-[300px] ${
                isOver 
                  ? "border-zinc-500/60 bg-[#161619] ring-1 ring-zinc-500/20 scale-[1.005]" 
                  : "border-[#222226]"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <span>{col.label}</span>
                </h4>
                <span className="text-[10px] bg-[#1a1a1e] text-zinc-400 px-2 py-0.5 rounded font-mono font-medium border border-[#27272a]">
                  {colTasks.length}
                </span>
              </div>

              {/* Task Cards Container */}
              <div className="flex flex-col gap-2.5 flex-1">
                {colTasks.length === 0 ? (
                  <div className={`py-12 text-center text-xs text-zinc-600 italic border-2 border-dashed rounded-xl transition ${
                    isOver ? "border-zinc-600/50 bg-zinc-800/20 text-zinc-300" : "border-zinc-800/40"
                  }`}>
                    {isOver ? "Lepaskan untuk memindahkan ke sini" : "Belum ada task di folder ini"}
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const isBeingDragged = draggedTaskId === task.id;

                    return (
                      <div 
                        key={task.id} 
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-[#161618] p-3.5 rounded-xl border shadow-sm flex flex-col gap-2.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                          isBeingDragged 
                            ? "opacity-40 border-dashed border-zinc-500 scale-[0.99]" 
                            : "border-[#222226] hover:border-zinc-700 hover:bg-[#19191c]"
                        }`}
                      >
                        {/* Top: Client Badge + Grip + Delete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <GripVertical size={13} className="text-zinc-600 hover:text-zinc-400 transition shrink-0 cursor-grab" />
                            {(() => {
                              const theme = getClientThemeByName(task.client, dbClients);
                              return (
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${theme.badge}`}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: theme.dot }} />
                                  <span>{task.client || "General"}</span>
                                </span>
                              );
                            })()}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            title="Hapus Task"
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Title: Direct Link to Notion-style Brief */}
                        <Link 
                          href={`/tasks/${task.id}`} 
                          className="hover:underline cursor-pointer group"
                        >
                          <p className="text-xs font-semibold text-zinc-100 leading-relaxed group-hover:text-white transition-colors">
                            {task.title || "Untitled Task"}
                          </p>
                        </Link>

                        {/* Assignee & Due Date */}
                        <div className="flex flex-col gap-1 pt-2 border-t border-[#222226] text-[10px] text-gray-400">
                          {task.assignee && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-zinc-500">Assignee:</span>
                              {task.assignee.split(",").map((a, idx) => {
                                const clean = a.trim();
                                if (!clean) return null;
                                return (
                                  <span key={idx} className="bg-zinc-800/80 text-zinc-200 font-medium px-1.5 py-0.5 rounded text-[10px]">
                                    @{clean}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-500">Due:</span>
                              <span className="text-zinc-200 font-medium font-mono">{task.dueDate}</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Status Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#222226]/50 text-[10px]">
                          {col.key !== "todo" && (
                            <button 
                              onClick={() => moveTask(task.id, "todo")} 
                              className="text-gray-400 hover:text-white transition cursor-pointer"
                            >
                              ← To Do
                            </button>
                          )}
                          {col.key !== "in_progress" && (
                            <button 
                              onClick={() => moveTask(task.id, "in_progress")} 
                              className="text-gray-300 hover:text-white transition ml-auto cursor-pointer"
                            >
                              Progress
                            </button>
                          )}
                          {col.key !== "done" && (
                            <button 
                              onClick={() => moveTask(task.id, "done")} 
                              className="text-white font-medium hover:underline transition ml-auto cursor-pointer flex items-center gap-1"
                            >
                              <span>Done</span>
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
