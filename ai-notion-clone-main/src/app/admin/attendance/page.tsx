"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  getAllAttendancesAction,
  getAdminEmailsAction,
  addAdminEmailAction,
  removeAdminEmailAction,
} from "@/actions/actions";
import {
  Clock,
  Calendar,
  Search,
  MapPin,
  Image as ImageIcon,
  Filter,
  LogIn,
  LogOut,
  ArrowLeft,
  RefreshCw,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
  User,
  ExternalLink,
  Lock,
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  timestamp: string | Date;
  imageUrl?: string | null;
  location?: string | null;
  note?: string | null;
}

export default function AdminAttendancePage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Accordion state: Set of expanded date keys
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Lightbox & Admin Management Modals
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminInput, setNewAdminInput] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);

  // Current user's email
  const currentUserEmail = (
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    ""
  ).toLowerCase().trim();

  // Load Presensi & Admin list
  const fetchData = async () => {
    setLoading(true);
    try {
      const [attendances, admins] = await Promise.all([
        getAllAttendancesAction(),
        getAdminEmailsAction(),
      ]);
      setRecords(attendances || []);
      setAdminEmails(admins || []);

      // Auto-expand the most recent day folder
      if (attendances && attendances.length > 0) {
        const firstDateKey = new Date(attendances[0].timestamp).toISOString().split("T")[0];
        setExpandedDates({ [firstDateKey]: true });
      }
    } catch (err) {
      console.error("Gagal memuat data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Check supervisor / admin access
  const isSupervisor = useMemo(() => {
    if (!currentUserEmail) return false;
    // Check against authorized email list
    const isAllowedEmail = adminEmails.some(
      (email) => email.toLowerCase().trim() === currentUserEmail
    );
    // Check Clerk role if available
    const isClerkAdmin = (user?.publicMetadata?.role as string) === "admin";
    return isAllowedEmail || isClerkAdmin;
  }, [currentUserEmail, adminEmails, user]);

  // Unique employees for filter dropdown
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    records.forEach((r) => {
      const email = r.userEmail?.toLowerCase().trim() || r.userId;
      if (!map.has(email)) {
        map.set(email, {
          name: r.userName || "Karyawan",
          email: r.userEmail || "",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch =
        (rec.userName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.userEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.location || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEmployee =
        selectedEmployee === "ALL" ||
        (rec.userEmail || "").toLowerCase().trim() === selectedEmployee.toLowerCase().trim() ||
        rec.userName === selectedEmployee;

      const matchesType = selectedType === "ALL" || rec.type === selectedType;

      return matchesSearch && matchesEmployee && matchesType;
    });
  }, [records, searchTerm, selectedEmployee, selectedType]);

  // Group filtered records by date ("folder per hari")
  const groupedByDate = useMemo(() => {
    const groups: {
      dateKey: string;
      dateLabel: string;
      isToday: boolean;
      isYesterday: boolean;
      total: number;
      clockInCount: number;
      clockOutCount: number;
      items: AttendanceRecord[];
    }[] = [];

    const dateMap = new Map<string, AttendanceRecord[]>();

    filteredRecords.forEach((rec) => {
      const d = new Date(rec.timestamp);
      // Format YYYY-MM-DD
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(rec);
    });

    const todayStr = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
    })();

    const yesterdayStr = (() => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(
        y.getDate()
      ).padStart(2, "0")}`;
    })();

    Array.from(dateMap.keys())
      .sort((a, b) => b.localeCompare(a)) // Latest date first
      .forEach((dateKey) => {
        const items = dateMap.get(dateKey) || [];
        const [year, month, day] = dateKey.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);

        const isToday = dateKey === todayStr;
        const isYesterday = dateKey === yesterdayStr;

        let dateLabel = dateObj.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        if (isToday) {
          dateLabel = `Hari Ini • ${dateLabel}`;
        } else if (isYesterday) {
          dateLabel = `Kemarin • ${dateLabel}`;
        }

        const clockInCount = items.filter((r) => r.type === "CLOCK_IN").length;
        const clockOutCount = items.filter((r) => r.type === "CLOCK_OUT").length;

        groups.push({
          dateKey,
          dateLabel,
          isToday,
          isYesterday,
          total: items.length,
          clockInCount,
          clockOutCount,
          items,
        });
      });

    return groups;
  }, [filteredRecords]);

  // Toggle folder accordion
  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  // Expand / Collapse all
  const toggleAllFolders = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    groupedByDate.forEach((g) => {
      newState[g.dateKey] = expand;
    });
    setExpandedDates(newState);
  };

  // Handler: Add supervisor
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminInput.trim()) return;
    setAdminActionLoading(true);
    setAdminActionMessage(null);
    try {
      const res = await addAdminEmailAction(newAdminInput.trim(), currentUserEmail || "Supervisor");
      if (res.success) {
        setNewAdminInput("");
        setAdminActionMessage("Email atasan berhasil ditambahkan.");
        const updated = await getAdminEmailsAction();
        setAdminEmails(updated);
      } else {
        setAdminActionMessage(res.error || "Gagal menambahkan email");
      }
    } catch {
      setAdminActionMessage("Terjadi kesalahan.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Handler: Remove supervisor
  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (!confirm(`Hapus hak akses atasan untuk ${emailToRemove}?`)) return;
    setAdminActionLoading(true);
    setAdminActionMessage(null);
    try {
      const res = await removeAdminEmailAction(emailToRemove);
      if (res.success) {
        setAdminActionMessage("Email berhasil dihapus dari daftar atasan.");
        const updated = await getAdminEmailsAction();
        setAdminEmails(updated);
      } else {
        setAdminActionMessage(res.error || "Gagal menghapus email");
      }
    } catch {
      setAdminActionMessage("Terjadi kesalahan.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  // 1. Loading State while clerk user checks
  if (!isUserLoaded) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-zinc-300 flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 rounded-full border-2 border-[#C65921] border-t-transparent animate-spin mb-3" />
        <p className="text-xs text-zinc-400 font-medium">Memverifikasi kredensial atasan...</p>
      </div>
    );
  }

  // 2. Private Access Screen (Unauthorized)
  if (!loading && !isSupervisor) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-zinc-200 flex items-center justify-center p-6 selection:bg-[#C65921]/30">
        <div className="max-w-md w-full bg-[#141417] border border-zinc-800 rounded-2xl p-7 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle warm accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#C65921]" />

          <div className="w-14 h-14 rounded-2xl bg-[#C65921]/10 border border-[#C65921]/20 text-[#C65921] flex items-center justify-center mx-auto mb-4">
            <Lock size={26} />
          </div>

          <span className="px-2.5 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider inline-block mb-2">
            Restricted Area • Private Workspace
          </span>

          <h1 className="text-xl font-bold text-white mb-2">
            Akses Khusus Atasan & Leadership
          </h1>

          <p className="text-xs text-zinc-400 leading-relaxed mb-5">
            Halaman rekap dan monitoring presensi ini bersifat privat dan hanya dapat diakses oleh
            atasan atau pimpinan tim Sika Creative.
          </p>

          <div className="bg-[#1a1b22] border border-zinc-800/90 rounded-xl p-3 mb-6 text-left text-xs space-y-1">
            <div className="text-[11px] text-zinc-500 font-medium">Akun Anda saat ini:</div>
            <div className="text-zinc-200 font-semibold truncate">
              {currentUserEmail || "Belum Login"}
            </div>
            <div className="text-[10px] text-zinc-500 pt-1">
              Jika Anda adalah atasan, hubungi Ben atau Superadmin untuk didaftarkan ke daftar atasan.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/"
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#C65921] hover:bg-[#d66428] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Beranda</span>
            </Link>
            <button
              onClick={fetchData}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition cursor-pointer"
            >
              Cek Ulang Izin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Supervisor Dashboard
  return (
    <div className="min-h-screen bg-[#0e0e11] text-zinc-200 p-4 sm:p-8 font-sans selection:bg-[#C65921]/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="bg-[#141417] border border-zinc-800/90 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          {/* Subtle terracotta indicator */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#C65921]" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <Link
                href="/"
                className="mt-0.5 p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition cursor-pointer shrink-0"
                title="Kembali ke Dashboard Utama"
              >
                <ArrowLeft size={18} />
              </Link>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#C65921]/15 text-[#e58a5c] border border-[#C65921]/30 text-[10px] font-semibold tracking-wide flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-[#C65921]" />
                    <span>Workspace Atasan (Private)</span>
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-[11px] text-zinc-400 font-medium">
                    Masuk sebagai: <strong className="text-zinc-200">{currentUserEmail}</strong>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1.5">
                  Monitoring Presensi Tim
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
                  Rekap jam masuk & keluar, swafoto terkini, serta verifikasi lokasi GPS seluruh
                  karyawan Sika Creative. Dikelompokkan per hari.
                </p>
              </div>
            </div>

            {/* Actions: Refresh & Manage Supervisor Access */}
            <div className="flex items-center gap-2.5 self-start lg:self-center">
              <button
                onClick={() => setShowAdminModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/70 text-xs font-semibold transition cursor-pointer flex items-center gap-2"
                title="Atur siapa saja atasan yang boleh membuka halaman ini"
              >
                <UserCheck size={15} className="text-[#C65921]" />
                <span>Kelola Akses Atasan</span>
              </button>

              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#C65921] hover:bg-[#d66428] text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2 shadow disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls (Filter Per Karyawan, Search, Type, Accordion Toggles) */}
        <div className="bg-[#141417] border border-zinc-800/90 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search size={15} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Cari nama karyawan, email, atau lokasi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1b22] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#C65921] transition shadow-inner"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Per Karyawan */}
            <div className="md:col-span-4 relative">
              <div className="flex items-center gap-2">
                <User size={15} className="text-zinc-500 shrink-0 ml-1" />
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full bg-[#1a1b22] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#C65921] cursor-pointer transition shadow-inner"
                >
                  <option value="ALL">Semua Karyawan ({uniqueEmployees.length})</option>
                  {uniqueEmployees.map((emp) => (
                    <option key={emp.email} value={emp.email}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Type (Clock In / Out) */}
            <div className="md:col-span-3 relative">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-zinc-500 shrink-0 ml-1" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-[#1a1b22] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#C65921] cursor-pointer transition shadow-inner"
                >
                  <option value="ALL">Semua Jenis Presensi</option>
                  <option value="CLOCK_IN">Hanya Clock In (Masuk)</option>
                  <option value="CLOCK_OUT">Hanya Clock Out (Keluar)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick summary and folder collapse/expand toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <span>
                Total Data: <strong className="text-zinc-200">{filteredRecords.length}</strong> presensi
              </span>
              <span>•</span>
              <span>
                Total Hari: <strong className="text-zinc-200">{groupedByDate.length}</strong> folder hari
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllFolders(true)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700/60 transition cursor-pointer"
              >
                Buka Semua Folder
              </button>
              <button
                onClick={() => toggleAllFolders(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium border border-zinc-700/60 transition cursor-pointer"
              >
                Tutup Semua Folder
              </button>
            </div>
          </div>
        </div>

        {/* Attendance Content: Folder Per Hari */}
        {loading ? (
          <div className="h-64 bg-[#141417] border border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center text-zinc-400 text-xs gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[#C65921] border-t-transparent animate-spin" />
            <span>Memuat rekap presensi tim...</span>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 border border-zinc-800/80 rounded-2xl bg-[#141417] p-6 text-center">
            <Clock size={32} className="opacity-30 text-zinc-400" />
            <span className="text-zinc-300 font-medium">Tidak ada data presensi yang sesuai.</span>
            <span className="text-zinc-500 text-[11px]">
              Coba sesuaikan kata kunci pencarian atau filter karyawan di atas.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDate.map((group) => {
              const isOpen = !!expandedDates[group.dateKey];

              return (
                <div
                  key={group.dateKey}
                  className="bg-[#141417] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-lg transition"
                >
                  {/* Folder Header (Clickable Accordion) */}
                  <button
                    onClick={() => toggleDate(group.dateKey)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left bg-[#17181f] hover:bg-[#1c1d25] transition cursor-pointer border-b border-zinc-800/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          group.isToday
                            ? "bg-[#C65921]/15 text-[#C65921] border-[#C65921]/30"
                            : "bg-zinc-800/80 text-zinc-400 border-zinc-700/50"
                        }`}
                      >
                        {isOpen ? <FolderOpen size={18} /> : <Folder size={18} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-white truncate">
                            {group.dateLabel}
                          </h2>
                          {group.isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-[#C65921]/20 text-[#e58a5c] border border-[#C65921]/30 text-[10px] font-semibold">
                              Hari Ini
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {group.total} catatan presensi tim
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      {/* Summary Badges for this Day */}
                      <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        {group.clockInCount} Masuk
                      </span>
                      <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#C65921]/15 text-[#e58a5c] border border-[#C65921]/30">
                        {group.clockOutCount} Keluar
                      </span>

                      <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Folder Content: Grid of Attendance Cards */}
                  {isOpen && (
                    <div className="p-4 sm:p-5 bg-[#121317]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.items.map((rec) => {
                          const dateObj = new Date(rec.timestamp);
                          const formattedTime = dateObj.toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          const isClockIn = rec.type === "CLOCK_IN";

                          return (
                            <div
                              key={rec.id}
                              className="bg-[#181920] border border-zinc-800/90 rounded-2xl p-4 flex flex-col gap-3 shadow-md hover:border-zinc-700 transition"
                            >
                              {/* Employee & Type Header */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs shrink-0">
                                    {rec.userName ? rec.userName.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-xs font-bold text-white truncate">
                                      {rec.userName || "Karyawan"}
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 truncate">
                                      {rec.userEmail}
                                    </p>
                                  </div>
                                </div>

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shrink-0 ${
                                    isClockIn
                                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                                      : "bg-[#C65921]/15 text-[#e58a5c] border-[#C65921]/30"
                                  }`}
                                >
                                  {isClockIn ? <LogIn size={10} /> : <LogOut size={10} />}
                                  <span>{isClockIn ? "Masuk" : "Keluar"}</span>
                                </span>
                              </div>

                              {/* Foto Presensi */}
                              <div className="relative w-full h-44 rounded-xl bg-black/60 border border-zinc-800 overflow-hidden flex items-center justify-center group">
                                {rec.imageUrl ? (
                                  <>
                                    <img
                                      src={rec.imageUrl}
                                      alt={`Presensi ${rec.userName}`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                      loading="lazy"
                                    />
                                    <button
                                      onClick={() => setSelectedPhoto(rec.imageUrl!)}
                                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1.5 cursor-pointer backdrop-blur-xs"
                                    >
                                      <ImageIcon size={14} />
                                      <span>Perbesar Foto</span>
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5 text-zinc-600 text-[11px]">
                                    <ImageIcon size={22} />
                                    <span>Tanpa Swafoto</span>
                                  </div>
                                )}
                              </div>

                              {/* Jam & Info */}
                              <div className="flex items-center justify-between text-[11px] bg-[#141418] px-3 py-2 rounded-xl border border-zinc-800/80">
                                <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                                  <Clock size={12} className="text-[#C65921]" />
                                  <span>{formattedTime} WIB</span>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-medium">
                                  {isClockIn ? "Clock In" : "Clock Out"}
                                </span>
                              </div>

                              {/* Lokasi GPS */}
                              {rec.location && (
                                <div className="flex items-start gap-1.5 text-[10px] text-zinc-400 px-1 font-medium">
                                  <MapPin size={11} className="text-[#C65921] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2" title={rec.location}>
                                    {rec.location}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Kelola Akses Atasan / Supervisors */}
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#141417] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminActionMessage(null);
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 mb-1.5">
                <ShieldCheck size={20} className="text-[#C65921]" />
                <h3 className="text-base font-bold text-white">Kelola Akses Atasan</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                Hanya akun dengan email di daftar ini yang diizinkan membuka halaman monitoring
                presensi privat ini.
              </p>

              {/* Add email form */}
              <form onSubmit={handleAddAdmin} className="space-y-3 mb-5">
                <label className="text-[11px] font-semibold text-zinc-300 block">
                  Tambah Email Atasan Baru:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="nama@sikacreative.com"
                    value={newAdminInput}
                    onChange={(e) => setNewAdminInput(e.target.value)}
                    className="flex-1 bg-[#1a1b22] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#C65921]"
                  />
                  <button
                    type="submit"
                    disabled={adminActionLoading}
                    className="px-4 py-2 bg-[#C65921] hover:bg-[#d66428] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Tambah
                  </button>
                </div>
              </form>

              {adminActionMessage && (
                <div className="mb-4 p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-300">
                  {adminActionMessage}
                </div>
              )}

              {/* List of current supervisors */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-zinc-400">
                  Daftar Atasan Terdaftar ({adminEmails.length}):
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {adminEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#1a1b22] border border-zinc-800 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck size={14} className="text-[#C65921] shrink-0" />
                        <span className="text-zinc-200 truncate font-medium">{email}</span>
                        {email === currentUserEmail && (
                          <span className="text-[10px] text-zinc-500 font-semibold">(Anda)</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(email)}
                        disabled={adminActionLoading}
                        className="text-zinc-500 hover:text-rose-400 p-1 transition cursor-pointer"
                        title="Hapus akses"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Full-screen Photo Lightbox */}
        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-pointer"
          >
            <div className="relative max-w-3xl w-full max-h-[85vh] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
              <img
                src={selectedPhoto}
                alt="Foto Presensi Full"
                className="w-full h-full object-contain bg-black"
              />
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-zinc-400 bg-black/70 px-3 py-1 rounded-full border border-zinc-800">
                Klik di mana saja untuk menutup
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
