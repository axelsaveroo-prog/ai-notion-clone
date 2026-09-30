"use client";

import { useState, useEffect } from "react";
import { getAllAttendancesAction } from "@/actions/actions";
import { MobileContainer } from "@/components/MobileContainer";
import { 
  Clock, 
  Calendar, 
  Search, 
  User, 
  MapPin, 
  Image as ImageIcon, 
  Filter, 
  CheckCircle2, 
  LogOut, 
  LogIn 
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
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-6 py-6 pb-28 text-zinc-200">
        
        {/* Header Bar Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                Admin Panel
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">
              Monitoring Presensi Tim
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Pantau jam kerja, swafoto presensi, dan lokasi masuk/keluar seluruh anggota tim secara real-time.
            </p>
          </div>

          <button
            onClick={fetchRecords}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700 transition cursor-pointer self-start sm:self-auto"
          >
            Refresh Data
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search size={15} className="absolute left-3.5 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#141414] border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-zinc-500 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#141414] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="ALL">Semua Presensi</option>
              <option value="CLOCK_IN">Clock In (Masuk)</option>
              <option value="CLOCK_OUT">Clock Out (Keluar)</option>
            </select>
          </div>
        </div>

        {/* List & Galeri Presensi */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-xs italic">
            Memuat data presensi dari database...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 border border-zinc-800/80 rounded-2xl bg-[#141414]">
            <Clock size={28} className="opacity-30" />
            <span>Belum ada data presensi yang tercatat.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {/* Info Header User & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs">
                        {rec.userName ? rec.userName.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white leading-tight">
                          {rec.userName || "Unknown User"}
                        </h3>
                        <p className="text-[10px] text-zinc-500">{rec.userEmail}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                        isClockIn
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {isClockIn ? <LogIn size={10} /> : <LogOut size={10} />}
                      <span>{isClockIn ? "Masuk" : "Keluar"}</span>
                    </span>
                  </div>

                  {/* Preview Foto Presensi */}
                  <div className="relative w-full h-44 rounded-xl bg-black/60 border border-zinc-800 overflow-hidden flex items-center justify-center group">
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
                          <span>Lihat Foto Penuh</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-zinc-600 text-[11px]">
                        <ImageIcon size={20} />
                        <span>Tanpa Lampiran Foto</span>
                      </div>
                    )}
                  </div>

                  {/* Detail Waktu & Lokasi */}
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
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 px-1">
                      <MapPin size={11} className="text-zinc-500 shrink-0" />
                      <span className="truncate">{rec.location}</span>
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
            <div className="relative max-w-2xl w-full max-h-[85vh] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
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
    </MobileContainer>
  );
}