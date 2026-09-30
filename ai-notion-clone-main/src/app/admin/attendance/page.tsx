"use client";

import { useState, useEffect } from "react";
import { getAllAttendancesAction } from "@/actions/actions";
import Link from "next/link";
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
  RefreshCw
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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await getAllAttendancesAction();
      setRecords(data);
    } catch (err) {
      console.error("Gagal memuat presensi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filteredRecords = records.filter((rec) => {
    const matchesName = 
      rec.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "ALL" || rec.type === selectedType;
    return matchesName && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 p-4 sm:p-8 font-sans selection:bg-amber-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navbar Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141414] border border-zinc-800/80 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 transition cursor-pointer"
              title="Kembali ke Dashboard Utama"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                  Admin Panel Only
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                Monitoring Presensi Tim
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Laporan jam kerja, lokasi GPS terkunci, dan swafoto presensi seluruh karyawan.
              </p>
            </div>
          </div>

          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#141414] border border-zinc-800/80 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-500 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#141414] border border-zinc-800/80 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer shadow-sm"
            >
              <option value="ALL">Semua Presensi</option>
              <option value="CLOCK_IN">Clock In (Masuk)</option>
              <option value="CLOCK_OUT">Clock Out (Keluar)</option>
            </select>
          </div>
        </div>

        {/* List & Galeri Presensi */}
        {loading ? (
          <div className="h-64 bg-[#141414] border border-zinc-800/80 rounded-2xl flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 italic">
            <RefreshCw size={20} className="animate-spin text-zinc-500" />
            <span>Memuat data presensi...</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 border border-zinc-800/80 rounded-2xl bg-[#141414]">
            <Clock size={32} className="opacity-30" />
            <span>Belum ada data presensi yang tercatat.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRecords.map((rec) => {
              const dateObj = new Date(rec.timestamp);
              const formattedDate = dateObj.toLocaleDateString("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dateObj.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              });

              const isClockIn = rec.type === "CLOCK_IN";

              return (
                <div
                  key={rec.id}
                  className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-lg hover:border-zinc-700 transition"
                >
                  {/* User & Status Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-bold text-xs shrink-0">
                        {rec.userName ? rec.userName.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white leading-tight truncate">
                          {rec.userName || "Unknown User"}
                        </h3>
                        <p className="text-[10px] text-zinc-500 truncate">{rec.userEmail}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shrink-0 ${
                        isClockIn
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {isClockIn ? <LogIn size={10} /> : <LogOut size={10} />}
                      <span>{isClockIn ? "Masuk" : "Keluar"}</span>
                    </span>
                  </div>

                  {/* Foto Presensi */}
                  <div className="relative w-full h-48 rounded-xl bg-black/60 border border-zinc-800 overflow-hidden flex items-center justify-center group">
                    {rec.imageUrl ? (
                      <>
                        <img
                          src={rec.imageUrl}
                          alt={`Presensi ${rec.userName}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <button
                          onClick={() => setSelectedPhoto(rec.imageUrl!)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1.5 cursor-pointer backdrop-blur-xs"
                        >
                          <ImageIcon size={14} />
                          <span>Perbesar Foto</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-zinc-600 text-[11px]">
                        <ImageIcon size={20} />
                        <span>Tanpa Swafoto</span>
                      </div>
                    )}
                  </div>

                  {/* Waktu & Lokasi GPS Terkunci */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#181818] p-2.5 rounded-xl border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-mono">
                      <Clock size={12} className="text-zinc-500" />
                      <span>{formattedTime} WIB</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-300 font-mono justify-end">
                      <Calendar size={12} className="text-zinc-500" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {rec.location && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 px-1 font-mono">
                      <MapPin size={11} className="text-zinc-500 shrink-0" />
                      <span className="truncate" title={rec.location}>{rec.location}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Pop-up Foto Ukuran Penuh */}
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