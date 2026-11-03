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
  ArrowLeft,
  RefreshCw,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  User,
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

  // Modals
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; name: string; time: string } | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmails, setAdminEmails] = useState<string[]>([
    "bintangeben17@gmail.com",
    "ben@sikacreative.com",
    "axelsaveroo@gmail.com",
  ]);
  const [newAdminInput, setNewAdminInput] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);

  // Current user's email
  const currentUserEmail = (
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    ""
  ).toLowerCase().trim();

  // Load Attendance & Admin list
  const fetchData = async () => {
    setLoading(true);
    try {
      const [attendances, admins] = await Promise.all([
        getAllAttendancesAction(),
        getAdminEmailsAction(),
      ]);
      setRecords(attendances || []);
      if (admins && admins.length > 0) {
        setAdminEmails(admins);
      }

      // Auto-expand today's or most recent date folder
      if (attendances && attendances.length > 0) {
        const firstDateKey = new Date(attendances[0].timestamp).toISOString().split("T")[0];
        setExpandedDates({ [firstDateKey]: true });
      }
    } catch (err) {
      console.error("Failed to load attendance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Check supervisor / manager access
  const isSupervisor = useMemo(() => {
    if (!currentUserEmail) return false;
    const normalized = currentUserEmail.toLowerCase().trim();

    // Explicit access for bintangeben17@gmail.com
    if (normalized === "bintangeben17@gmail.com") return true;

    // Check database & authorized emails
    const isAllowedEmail = adminEmails.some(
      (email) => email.toLowerCase().trim() === normalized
    );
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
          name: r.userName || "Unnamed Employee",
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

  // Group filtered records by date ("folder per day")
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
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(rec);
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(
      yesterdayObj.getMonth() + 1
    ).padStart(2, "0")}-${String(yesterdayObj.getDate()).padStart(2, "0")}`;

    Array.from(dateMap.keys())
      .sort((a, b) => b.localeCompare(a)) // Newest date first
      .forEach((dateKey) => {
        const items = dateMap.get(dateKey) || [];
        const [year, month, day] = dateKey.split("-").map(Number);
        const dateObj = new Date(year, month - 1, day);

        const isToday = dateKey === todayStr;
        const isYesterday = dateKey === yesterdayStr;

        let dateLabel = dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        if (isToday) {
          dateLabel = `Today • ${dateLabel}`;
        } else if (isYesterday) {
          dateLabel = `Yesterday • ${dateLabel}`;
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

  // Expand / Collapse all folders
  const toggleAllFolders = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    groupedByDate.forEach((g) => {
      newState[g.dateKey] = expand;
    });
    setExpandedDates(newState);
  };

  // Handler: Add manager
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminInput.trim()) return;
    setAdminActionLoading(true);
    setAdminActionMessage(null);
    try {
      const res = await addAdminEmailAction(
        newAdminInput.trim(),
        currentUserEmail || "Manager"
      );
      if (res.success) {
        setNewAdminInput("");
        setAdminActionMessage("Manager email granted access.");
        const updated = await getAdminEmailsAction();
        setAdminEmails(updated);
      } else {
        setAdminActionMessage(res.error || "Failed to add email");
      }
    } catch {
      setAdminActionMessage("An error occurred while adding manager.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Handler: Remove manager
  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (!confirm(`Revoke manager access for ${emailToRemove}?`)) return;
    setAdminActionLoading(true);
    setAdminActionMessage(null);
    try {
      const res = await removeAdminEmailAction(emailToRemove);
      if (res.success) {
        setAdminActionMessage("Access revoked.");
        const updated = await getAdminEmailsAction();
        setAdminEmails(updated);
      } else {
        setAdminActionMessage(res.error || "Failed to remove email");
      }
    } catch {
      setAdminActionMessage("An error occurred.");
    } finally {
      setAdminActionLoading(false);
    }
  };

  // 1. Initial Loading State
  if (!isUserLoaded) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-zinc-400 flex flex-col items-center justify-center p-6 font-sans">
        <RefreshCw size={18} className="animate-spin text-zinc-500 mb-3" />
        <p className="text-xs text-zinc-500">Checking permissions...</p>
      </div>
    );
  }

  // 2. Restricted Access View (Notion Minimalist Style, No AI look)
  if (!loading && !isSupervisor) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-zinc-200 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 flex items-center justify-center mx-auto">
            <Lock size={18} />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Restricted Access
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
              This attendance workspace is private and restricted to authorized managers.
            </p>
          </div>

          <div className="text-xs text-zinc-500 bg-[#141417] border border-zinc-800/90 rounded-xl p-3 text-left">
            <div className="text-[11px] text-zinc-500">Signed in as:</div>
            <div className="text-zinc-300 font-medium truncate mt-0.5">
              {currentUserEmail || "Not signed in"}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/80 transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </Link>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg bg-[#C65921] hover:bg-[#d86629] text-white text-xs font-medium transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Attendance Dashboard (Clean Notion Minimalist Design)
  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-200 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header / Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/" className="hover:text-zinc-300 transition flex items-center gap-1">
                <ArrowLeft size={13} />
                <span>HQ</span>
              </Link>
              <span>/</span>
              <span className="text-zinc-400">Team Attendance</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Team Attendance
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                Managers Only
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Daily clock-in logs, verified locations, and check-in records.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-xs font-medium border border-zinc-700/60 transition cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck size={14} className="text-[#C65921]" />
              <span>Manage Access</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-[#C65921] hover:bg-[#d86629] text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Database Toolbar (Search, Filter by Employee, Filter by Type) */}
        <div className="bg-[#121317] border border-zinc-800/80 rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by employee, email, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#181920] border border-zinc-800 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Employee Filter */}
            <div className="md:col-span-4 flex items-center gap-1.5">
              <User size={14} className="text-zinc-500 shrink-0 ml-1" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-[#181920] border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="ALL">All Employees ({uniqueEmployees.length})</option>
                {uniqueEmployees.map((emp) => (
                  <option key={emp.email} value={emp.email}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="md:col-span-3 flex items-center gap-1.5">
              <Filter size={14} className="text-zinc-500 shrink-0 ml-1" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-[#181920] border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="CLOCK_IN">Clock In</option>
                <option value="CLOCK_OUT">Clock Out</option>
              </select>
            </div>
          </div>

          {/* Sub-toolbar summary & toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
            <div className="flex items-center gap-3">
              <span>
                Total records: <span className="text-zinc-300 font-medium">{filteredRecords.length}</span>
              </span>
              <span>•</span>
              <span>
                Days: <span className="text-zinc-300 font-medium">{groupedByDate.length}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllFolders(true)}
                className="hover:text-zinc-300 transition cursor-pointer"
              >
                Expand all
              </button>
              <span>|</span>
              <button
                onClick={() => toggleAllFolders(false)}
                className="hover:text-zinc-300 transition cursor-pointer"
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>

        {/* Content: Folders per Day */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2">
            <RefreshCw size={18} className="animate-spin text-zinc-500" />
            <span>Loading records...</span>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs space-y-1 bg-[#121317] border border-zinc-800/70 rounded-xl">
            <Clock size={24} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-zinc-300 font-medium">No attendance records found</p>
            <p className="text-zinc-500 text-[11px]">
              Try adjusting your search query or employee filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByDate.map((group) => {
              const isOpen = !!expandedDates[group.dateKey];

              return (
                <div
                  key={group.dateKey}
                  className="bg-[#121317] border border-zinc-800/70 rounded-xl overflow-hidden transition"
                >
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleDate(group.dateKey)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#16171d] transition cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-zinc-400">
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </div>

                      <div className="text-zinc-400">
                        {isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {group.dateLabel}
                        </span>
                        {group.isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#C65921]/15 text-[#e58a5c] border border-[#C65921]/30">
                            Today
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[11px]">
                      <span className="text-zinc-500">
                        {group.total} {group.total === 1 ? "entry" : "entries"}
                      </span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-emerald-400/90 font-medium">
                        {group.clockInCount} In
                      </span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-[#e58a5c] font-medium">
                        {group.clockOutCount} Out
                      </span>
                    </div>
                  </button>

                  {/* Folder Items */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-zinc-800/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                        {group.items.map((rec) => {
                          const dateObj = new Date(rec.timestamp);
                          const formattedTime = dateObj.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          const isClockIn = rec.type === "CLOCK_IN";

                          return (
                            <div
                              key={rec.id}
                              className="bg-[#181920] border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-2.5 hover:border-zinc-700 transition"
                            >
                              {/* Employee & Type */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-300 font-semibold text-[11px] shrink-0">
                                    {rec.userName ? rec.userName.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-white truncate">
                                      {rec.userName || "Unnamed"}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 truncate">
                                      {rec.userEmail}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 flex items-center gap-1 ${
                                    isClockIn
                                      ? "bg-emerald-950/30 text-emerald-300 border-emerald-900/40"
                                      : "bg-[#C65921]/15 text-[#e58a5c] border-[#C65921]/30"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isClockIn ? "bg-emerald-400" : "bg-[#C65921]"
                                    }`}
                                  />
                                  <span>{isClockIn ? "Clock In" : "Clock Out"}</span>
                                </span>
                              </div>

                              {/* Photo Thumbnail */}
                              <div className="relative w-full h-36 rounded-lg bg-black/40 border border-zinc-800/80 overflow-hidden flex items-center justify-center group">
                                {rec.imageUrl ? (
                                  <>
                                    <img
                                      src={rec.imageUrl}
                                      alt={`${rec.userName} attendance`}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                      loading="lazy"
                                    />
                                    <button
                                      onClick={() =>
                                        setSelectedPhoto({
                                          url: rec.imageUrl!,
                                          name: rec.userName,
                                          time: `${formattedTime} WIB`,
                                        })
                                      }
                                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1.5 cursor-pointer backdrop-blur-[2px]"
                                    >
                                      <ImageIcon size={13} />
                                      <span>View photo</span>
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center gap-1 text-zinc-600 text-[10px]">
                                    <ImageIcon size={18} />
                                    <span>No photo</span>
                                  </div>
                                )}
                              </div>

                              {/* Time & Location */}
                              <div className="space-y-1 text-[11px] pt-0.5">
                                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                                  <Clock size={11} className="text-zinc-500" />
                                  <span>{formattedTime} WIB</span>
                                </div>

                                {rec.location && (
                                  <div className="flex items-start gap-1.5 text-[10px] text-zinc-500">
                                    <MapPin size={11} className="text-zinc-500 shrink-0 mt-0.5" />
                                    <span className="line-clamp-1" title={rec.location}>
                                      {rec.location}
                                    </span>
                                  </div>
                                )}
                              </div>
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

        {/* Modal: Manage Access (Managers list) */}
        {showAdminModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <div className="bg-[#141417] border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#C65921]" />
                  <h3 className="text-sm font-semibold text-white">Manage Access</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAdminModal(false);
                    setAdminActionMessage(null);
                  }}
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Users on this list can view and manage team attendance logs.
              </p>

              {/* Add form */}
              <form onSubmit={handleAddAdmin} className="space-y-2">
                <label className="text-[11px] text-zinc-400 font-medium block">
                  Add Manager Email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="name@sikacreative.com"
                    value={newAdminInput}
                    onChange={(e) => setNewAdminInput(e.target.value)}
                    className="flex-1 bg-[#181920] border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    type="submit"
                    disabled={adminActionLoading}
                    className="px-3.5 py-2 bg-[#C65921] hover:bg-[#d86629] text-white text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>

              {adminActionMessage && (
                <div className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300">
                  {adminActionMessage}
                </div>
              )}

              {/* List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] text-zinc-500 font-medium">
                  Authorized Managers ({adminEmails.length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {adminEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#181920] border border-zinc-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <UserCheck size={13} className="text-[#C65921] shrink-0" />
                        <span className="text-zinc-300 truncate">{email}</span>
                        {email === currentUserEmail && (
                          <span className="text-[10px] text-zinc-500 font-medium">(You)</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(email)}
                        disabled={adminActionLoading}
                        className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer transition"
                        title="Revoke access"
                      >
                        <UserX size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowAdminModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Photo Lightbox */}
        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 cursor-pointer"
          >
            <div className="relative max-w-2xl w-full bg-[#141417] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-white">{selectedPhoto.name}</span>
                <span>{selectedPhoto.time}</span>
              </div>
              <div className="p-2 bg-black flex items-center justify-center max-h-[75vh]">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.name}
                  className="max-h-[70vh] w-auto object-contain rounded"
                />
              </div>
              <div className="p-2.5 text-center text-[11px] text-zinc-500 bg-[#141417] border-t border-zinc-800">
                Click anywhere to close
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
