"use client";

import { use, useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Tag as TagIcon, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  Check, 
  Loader2, 
  Trash2, 
  AlertCircle,
  Plus,
  X,
  Pencil
} from "lucide-react";
import { 
  getTaskByIdAction, 
  updateTaskAction, 
  deleteTaskAction, 
  getUsersAction,
  getClientsAction,
  createClientAction,
  updateClientAction,
  deleteClientAction
} from "@/actions/actions";
import { 
  COLOR_OPTIONS_LIST, 
  getClientThemeByName 
} from "@/lib/client-colors";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Opsi pilihan ala Notion / Linear (Soft Luxury Palette, Non-Neon)
const TYPE_OPTIONS = [
  { label: "Feeds", color: "bg-[#202022] text-[#d4d4d8] border-[#323236] hover:bg-[#27272b]" },
  { label: "Story", color: "bg-[#1d2126] text-[#cbd5e1] border-[#2e353f] hover:bg-[#242a32]" },
  { label: "Reels", color: "bg-[#24221f] text-[#ded7cd] border-[#3a352f] hover:bg-[#2c2925]" },
  { label: "Carousel", color: "bg-[#232023] text-[#dcd2dc] border-[#383038] hover:bg-[#2b272b]" },
  { label: "Others", color: "bg-[#1c1c1f] text-[#a1a1aa] border-[#2e2e32] hover:bg-[#242428]" },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", color: "bg-zinc-800/60 text-zinc-300 border-zinc-700/60 hover:bg-zinc-800" },
  { value: "in_progress", label: "In Progress", color: "bg-[#26231c] text-[#e8dcbe] border-[#3d3728] hover:bg-[#2e2920]" },
  { value: "done", label: "Done", color: "bg-[#1d231f] text-[#c2dbcb] border-[#2e3b32] hover:bg-[#242e27]" },
  { value: "Brief Ready", label: "Brief Ready", color: "bg-[#251f20] text-[#dfcfcf] border-[#3f2e30] hover:bg-[#2e2526]" },
  { value: "Editing", label: "Editing", color: "bg-[#1e2226] text-[#cbd6df] border-[#2e3740] hover:bg-[#252b31]" },
  { value: "Edited", label: "Edited", color: "bg-[#25221d] text-[#ded3c2] border-[#3e3428] hover:bg-[#2e2820]" },
  { value: "Revisi", label: "Revisi", color: "bg-[#24221d] text-[#e2d8be] border-[#3d3627] hover:bg-[#2c2820]" },
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface DbClient {
  id: string;
  name: string;
  color: string;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;
  const router = useRouter();
  const { user } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // State nilai data realtime dari DB
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Feeds");
  const [client, setClient] = useState("General");
  const [status, setStatus] = useState("todo");
  const [assignee, setAssignee] = useState("You");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [dbClients, setDbClients] = useState<DbClient[]>([]);

  // State pembuatan client baru
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientColor, setNewClientColor] = useState("sky");
  const [isSavingNewClient, setIsSavingNewClient] = useState(false);

  // State edit client
  const [editingClient, setEditingClient] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientColor, setEditClientColor] = useState("sky");
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  // State menu popover dropdown yang sedang aktif
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // Load Task, Members, and Database Clients
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [taskData, usersData, clientsData] = await Promise.all([
          getTaskByIdAction(taskId),
          getUsersAction(),
          getClientsAction(),
        ]);

        if (!mounted) return;

        if (usersData && Array.isArray(usersData)) {
          setMembers(usersData);
        }

        if (clientsData && Array.isArray(clientsData)) {
          setDbClients(clientsData);
        }

        if (!taskData) {
          setNotFound(true);
        } else {
          setTitle(taskData.title || "");
          setType(taskData.type || "Feeds");
          setClient(taskData.client || "General");
          setStatus(taskData.status || "todo");
          setAssignee(taskData.assignee || "You");
          setDue(taskData.dueDate || "");
          setContent(taskData.brief || "");
        }
      } catch (err) {
        console.error("Gagal memuat task:", err);
        if (mounted) setNotFound(true);
      } finally {
        if (mounted) {
          setIsLoading(false);
          // Set flag agar tidak langsung trigger debounce save saat pertama load
          setTimeout(() => {
            isInitialLoad.current = false;
          }, 300);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  // Save changes ke database
  const saveChanges = useCallback(
    async (overrideData?: Partial<{
      title: string;
      type: string;
      client: string;
      status: string;
      assignee: string;
      dueDate: string;
      brief: string;
    }>) => {
      if (isInitialLoad.current || notFound) return;

      setSaveStatus("saving");
      try {
        const payload = {
          title: overrideData?.title !== undefined ? overrideData.title : title,
          type: overrideData?.type !== undefined ? overrideData.type : type,
          client: overrideData?.client !== undefined ? overrideData.client : client,
          status: overrideData?.status !== undefined ? overrideData.status : status,
          assignee: overrideData?.assignee !== undefined ? overrideData.assignee : assignee,
          dueDate: overrideData?.dueDate !== undefined ? overrideData.dueDate : due,
          brief: overrideData?.brief !== undefined ? overrideData.brief : content,
        };

        const res = await updateTaskAction(taskId, payload);
        if (res && res.success) {
          setSaveStatus("saved");
          setTimeout(() => {
            setSaveStatus("idle");
          }, 2500);
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        console.error("Gagal menyimpan task:", err);
        setSaveStatus("error");
      }
    },
    [taskId, title, type, client, status, assignee, due, content, notFound]
  );

  // Debounced auto-save untuk text inputs (Title & Content)
  const triggerDebouncedSave = useCallback(() => {
    if (isInitialLoad.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveChanges();
    }, 450);
  }, [saveChanges]);

  // Immediate save saat input kehilangan fokus (onBlur)
  const handleBlurSave = useCallback(() => {
    if (isInitialLoad.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    saveChanges();
  }, [saveChanges]);

  // Menutup menu jika klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus task ini?")) return;
    try {
      await deleteTaskAction(taskId);
      toast.success("Task berhasil dihapus");
      router.push("/tasks");
    } catch {
      toast.error("Gagal menghapus task");
    }
  };

  const handleCreateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newClientName.trim();
    if (!trimmed || isSavingNewClient) return;

    setIsSavingNewClient(true);
    try {
      const res = await createClientAction({
        name: trimmed,
        color: newClientColor,
      });
      if (res && res.success && res.client) {
        setDbClients((prev) => {
          const filtered = prev.filter((c) => c.name.toLowerCase() !== trimmed.toLowerCase());
          return [...filtered, res.client].sort((a, b) => a.name.localeCompare(b.name));
        });
        setClient(res.client.name);
        saveChanges({ client: res.client.name });
        setNewClientName("");
        setIsAddingClient(false);
        setOpenDropdown(null);
        toast.success(`Client "${res.client.name}" berhasil disimpan ke database!`);
      } else {
        toast.error(res?.error || "Gagal membuat client");
      }
    } catch (err: any) {
      toast.error("Gagal membuat client baru");
    } finally {
      setIsSavingNewClient(false);
    }
  };

  const handleStartEditClient = (c: DbClient) => {
    setEditingClient({ id: c.id, name: c.name, color: c.color || "sky" });
    setEditClientName(c.name);
    setEditClientColor(c.color || "sky");
    setIsAddingClient(false);
  };

  const handleUpdateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClient) return;
    const trimmed = editClientName.trim();
    if (!trimmed || isUpdatingClient) return;

    setIsUpdatingClient(true);
    try {
      const res = await updateClientAction(editingClient.id, {
        name: trimmed,
        color: editClientColor,
      });

      if (res && res.success && res.client) {
        setDbClients((prev) =>
          prev.map((c) => (c.id === editingClient.id ? res.client! : c))
        );
        if (client.toLowerCase() === editingClient.name.toLowerCase()) {
          setClient(res.client.name);
          saveChanges({ client: res.client.name });
        }
        setEditingClient(null);
        toast.success(`Client "${res.client.name}" berhasil diupdate!`);
      } else {
        toast.error(res?.error || "Gagal mengupdate client");
      }
    } catch {
      toast.error("Gagal mengupdate client");
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Hapus client "${clientName}" dari database?`)) return;
    setDeletingClientId(clientId);
    try {
      const res = await deleteClientAction(clientId);
      if (res && res.success) {
        setDbClients((prev) => prev.filter((c) => c.id !== clientId));
        if (client.toLowerCase() === clientName.toLowerCase()) {
          const remaining = dbClients.filter((c) => c.id !== clientId);
          const nextClient = remaining[0]?.name || "General";
          setClient(nextClient);
          saveChanges({ client: nextClient });
        }
        toast.success(`Client "${clientName}" berhasil dihapus.`);
      } else {
        toast.error(res?.error || "Gagal menghapus client");
      }
    } catch {
      toast.error("Gagal menghapus client");
    } finally {
      setDeletingClientId(null);
    }
  };

  const currentType = TYPE_OPTIONS.find((t) => t.label === type) || TYPE_OPTIONS[0];
  const currentClientTheme = getClientThemeByName(client, dbClients);
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === status || s.label === status) || STATUS_OPTIONS[0];

  // Daftar nama assignee dari database users
  const assigneeNames = Array.from(
    new Set([
      ...members.map((m) => m.name),
      user?.fullName || user?.username || "You",
    ].filter(Boolean))
  ) as string[];

  const selectedAssignees = useMemo(() => {
    if (!assignee) return [];
    return assignee.split(",").map((s) => s.trim()).filter(Boolean);
  }, [assignee]);

  const toggleAssignee = (name: string) => {
    let updated: string[];
    if (selectedAssignees.includes(name)) {
      updated = selectedAssignees.filter((n) => n !== name);
    } else {
      updated = [...selectedAssignees, name];
    }
    const val = updated.length > 0 ? updated.join(", ") : "Unassigned";
    setAssignee(val);
    saveChanges({ assignee: val });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] text-zinc-200 p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-500">Memuat detail task realtime...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] text-zinc-200 p-8 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <h2 className="text-lg font-semibold text-white">Task Tidak Ditemukan</h2>
        <p className="text-xs text-zinc-400">Task ini mungkin telah dihapus atau ID tidak valid.</p>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-medium transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Kembali ke Task Board
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-zinc-200 p-8 pb-32">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Task Board
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            title="Hapus Task"
            className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Kontainer Halaman */}
      <div 
        ref={popoverRef}
        className="max-w-4xl mx-auto bg-[#141414] border border-zinc-800/80 rounded-2xl p-8 shadow-xl"
      >
        {/* Title (Inline Editable) */}
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            triggerDebouncedSave();
          }}
          onBlur={handleBlurSave}
          className="w-full bg-transparent text-3xl font-bold text-white mb-6 tracking-tight focus:outline-none focus:border-b focus:border-zinc-700 pb-1"
          placeholder="Judul task..."
        />

        {/* Notion Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 pb-8 mb-8 border-b border-zinc-800/80 text-sm">
          
          {/* PROPERTY: TYPE */}
          <div className="flex items-center relative">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <TagIcon size={15} /> Type
            </span>
            <button
              onClick={() => setOpenDropdown(openDropdown === "type" ? null : "type")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${currentType.color}`}
            >
              {type}
              <ChevronDown size={13} className="opacity-70" />
            </button>

            {openDropdown === "type" && (
              <div className="absolute left-32 top-8 z-50 w-48 bg-[#1F1F1F] border border-zinc-800 rounded-lg p-1.5 shadow-2xl space-y-1">
                {TYPE_OPTIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setType(item.label);
                      setOpenDropdown(null);
                      saveChanges({ type: item.label });
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    {type === item.label && <Check size={14} className="text-zinc-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PROPERTY: CLIENT */}
          <div className="flex items-center relative">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <CheckCircle2 size={15} /> Client
            </span>
            <button
              onClick={() => {
                setOpenDropdown(openDropdown === "client" ? null : "client");
                setIsAddingClient(false);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${currentClientTheme.badge}`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentClientTheme.dot }} />
              {client}
              <ChevronDown size={13} className="opacity-70" />
            </button>

            {openDropdown === "client" && (
              <div className="absolute left-32 top-8 z-50 w-80 bg-[#1A1A1D] border border-zinc-800 rounded-xl p-2.5 shadow-2xl space-y-2">
                {editingClient ? (
                  <form onSubmit={handleUpdateClient} className="space-y-2.5 p-1">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-[11px] font-semibold text-white">Edit Client</span>
                      <button
                        type="button"
                        onClick={() => setEditingClient(null)}
                        className="text-zinc-400 hover:text-white transition p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        autoFocus
                        value={editClientName}
                        onChange={(e) => setEditClientName(e.target.value)}
                        placeholder="Nama client..."
                        className="w-full bg-[#141416] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-1.5 font-medium">Pilihan Warna (Soft):</span>
                      <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {COLOR_OPTIONS_LIST.map((opt) => {
                          const isPicked = editClientColor === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setEditClientColor(opt.key)}
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

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setEditingClient(null)}
                        className="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={!editClientName.trim() || isUpdatingClient}
                        className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        {isUpdatingClient ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        <span>Simpan Perubahan</span>
                      </button>
                    </div>
                  </form>
                ) : !isAddingClient ? (
                  <>
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {dbClients.map((item) => {
                        const theme = getClientThemeByName(item.name, dbClients);
                        const isSelected = client.toLowerCase() === item.name.toLowerCase();
                        return (
                          <div
                            key={item.id || item.name}
                            className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              isSelected ? "bg-zinc-800/80 text-white" : "hover:bg-zinc-800/50 text-zinc-300"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setClient(item.name);
                                setOpenDropdown(null);
                                saveChanges({ client: item.name });
                              }}
                              className="flex items-center gap-2 flex-1 text-left cursor-pointer truncate"
                            >
                              <span 
                                className="w-2 h-2 rounded-full shrink-0" 
                                style={{ backgroundColor: theme.dot }} 
                              />
                              <span className={`px-2 py-0.5 rounded border text-[11px] font-medium truncate ${theme.badge}`}>
                                {item.name}
                              </span>
                              {isSelected && <Check size={13} className="text-zinc-300 shrink-0 ml-1" />}
                            </button>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditClient(item);
                                }}
                                title="Edit Client"
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition cursor-pointer"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                disabled={deletingClientId === item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClient(item.id, item.name);
                                }}
                                title="Hapus Client"
                                className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              >
                                {deletingClientId === item.id ? (
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

                    <div className="pt-2 border-t border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingClient(true);
                          setEditingClient(null);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-200 border border-zinc-700/60 transition cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>+ Tambah Client & Pilih Warna</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleCreateClient} className="space-y-2.5 p-1">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                      <span className="text-[11px] font-semibold text-white">Client Baru</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingClient(false);
                          setNewClientName("");
                        }}
                        className="text-zinc-400 hover:text-white transition p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        autoFocus
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Nama client (misal: BABA)..."
                        className="w-full bg-[#141416] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-1.5 font-medium">Pilihan Warna (Soft):</span>
                      <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {COLOR_OPTIONS_LIST.map((opt) => {
                          const isPicked = newClientColor === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => setNewClientColor(opt.key)}
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

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingClient(false);
                          setNewClientName("");
                        }}
                        className="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={!newClientName.trim() || isSavingNewClient}
                        className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition cursor-pointer flex items-center gap-1 shadow-sm"
                      >
                        {isSavingNewClient ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        <span>Simpan</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* PROPERTY: STATUS */}
          <div className="flex items-center relative">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <Clock size={15} /> Status
            </span>
            <button
              onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${currentStatus.color}`}
            >
              {currentStatus.label}
              <ChevronDown size={13} className="opacity-70" />
            </button>

            {openDropdown === "status" && (
              <div className="absolute left-32 top-8 z-50 w-44 bg-[#1F1F1F] border border-zinc-800 rounded-lg p-1.5 shadow-2xl space-y-1">
                {STATUS_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setStatus(item.value);
                      setOpenDropdown(null);
                      saveChanges({ status: item.value });
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    {(status === item.value || status === item.label) && <Check size={14} className="text-zinc-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PROPERTY: ASSIGNEE (MULTIPLE) */}
          <div className="flex items-center relative">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <UserIcon size={15} /> Assignee
            </span>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === "assignee" ? null : "assignee")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer max-w-[300px]"
            >
              {selectedAssignees.length === 0 ? (
                <span className="text-zinc-500">Pilih Assignee...</span>
              ) : (
                <div className="flex items-center gap-1 overflow-hidden truncate">
                  {selectedAssignees.slice(0, 2).map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-700/80 text-[11px] text-zinc-200">
                      <span className="w-3.5 h-3.5 rounded-full bg-zinc-600 flex items-center justify-center text-[9px] font-bold">
                        {a[0]?.toUpperCase()}
                      </span>
                      <span className="truncate max-w-[80px]">{a}</span>
                    </span>
                  ))}
                  {selectedAssignees.length > 2 && (
                    <span className="text-[10px] text-zinc-400 font-mono">+{selectedAssignees.length - 2}</span>
                  )}
                </div>
              )}
              <ChevronDown size={13} className="text-zinc-400 shrink-0 ml-1" />
            </button>

            {openDropdown === "assignee" && (
              <div className="absolute left-32 top-8 z-50 w-64 max-h-64 overflow-y-auto bg-[#1F1F1F] border border-zinc-800 rounded-xl p-1.5 shadow-2xl space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 border-b border-zinc-800/60 flex items-center justify-between">
                  <span>Pilih Assignee</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{selectedAssignees.length} dipilih</span>
                </div>
                {assigneeNames.map((name) => {
                  const isSelected = selectedAssignees.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleAssignee(name)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition cursor-pointer ${
                        isSelected ? "bg-zinc-800 text-white font-medium" : "text-zinc-300 hover:bg-zinc-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-5 h-5 rounded-full bg-zinc-700 text-[10px] flex items-center justify-center font-bold text-zinc-200 shrink-0">
                          {name[0]?.toUpperCase()}
                        </div>
                        <span className="truncate">{name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PROPERTY: DUE DATE */}
          <div className="flex items-center">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <CalendarIcon size={15} /> Due Date
            </span>
            <input
              type="date"
              value={due}
              onChange={(e) => {
                const newDue = e.target.value;
                setDue(newDue);
                saveChanges({ dueDate: newDue });
              }}
              className="bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 rounded-md px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono transition-colors"
            />
          </div>

        </div>

        {/* Notion Content Brief Body */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase font-semibold tracking-wider text-zinc-500">
              Brief & Deliverables Content
            </h3>
            <span className="text-[11px] text-zinc-500">
              Tersinkronisasi realtime ke database
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              triggerDebouncedSave();
            }}
            onBlur={handleBlurSave}
            rows={14}
            className="w-full bg-[#181818] border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm leading-relaxed focus:outline-none focus:border-zinc-600 transition-colors resize-y"
          />
        </div>
      </div>
    </div>
  );
}