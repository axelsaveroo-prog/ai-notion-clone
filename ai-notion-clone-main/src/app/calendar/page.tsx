"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { 
  createCalendarEventAction, 
  getCalendarEventsAction, 
  deleteCalendarEventAction 
} from "@/actions/actions";
import { MobileContainer } from "@/components/MobileContainer";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  Trash2, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  CalendarDays
} from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  userId: string;
  userName?: string | null;
}

export default function CalendarPage() {
  const { user, isLoaded } = useUser();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State Modal Modal Tambah Jadwal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedTime, setSelectedTime] = useState("09:00");

  // Fetch semua jadwal
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getCalendarEventsAction();
      setEvents(data);
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      fetchEvents();
    }
  }, [isLoaded]);

  // Simpan Jadwal Baru
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Judul agenda/jadwal tidak boleh kosong!");
      return;
    }

    if (!user) {
      alert("Sesi login pengguna tidak ditemukan.");
      return;
    }

    setSubmitting(true);

    try {
      // Gabungkan string Tanggal & Jam menjadi Date Object ISO
      const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);

      const res = await createCalendarEventAction({
        title,
        description,
        startDate: startDateTime,
        userId: user.id,
        userName: user.fullName || user.username || "User",
      });

      if (res.success) {
        alert("Jadwal baru berhasil disimpan!");
        setTitle("");
        setDescription("");
        setIsModalOpen(false);
        await fetchEvents();
      } else {
        alert("Gagal menyimpan jadwal: " + res.error);
      }
    } catch (err) {
      console.error("Error saving event:", err);
      alert("Terjadi kesalahan jaringan atau server saat menyimpan.");
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus Jadwal
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) return;

    try {
      const res = await deleteCalendarEventAction(eventId);
      if (res.success) {
        await fetchEvents();
      } else {
        alert("Gagal menghapus jadwal.");
      }
    } catch (err) {
      console.error("Gagal menghapus jadwal:", err);
    }
  };

  return (
    <MobileContainer>
      <div className="flex-1 flex flex-col gap-5 py-5 pb-28 text-zinc-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                Schedule & Tasks
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white mt-1">
              Kalender Jadwal
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Kelola seluruh agenda, jadwal kerja, dan kegiatan tim Sika Creative.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Buat Jadwal</span>
          </button>
        </div>

        {/* List Agenda / Events */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2">
            <RefreshCw size={20} className="animate-spin text-zinc-500" />
            <span>Memuat data jadwal...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-xs gap-2 border border-zinc-800/80 rounded-2xl bg-[#141414]">
            <CalendarDays size={32} className="opacity-30" />
            <span>Belum ada agenda jadwal tersimpan.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const dateObj = new Date(ev.startDate);
              const formattedDate = dateObj.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dateObj.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={ev.id}
                  className="bg-[#141414] border border-zinc-800/80 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-md hover:border-zinc-700 transition"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-amber-400 flex items-center gap-1">
                        <Clock size={10} />
                        <span>{formattedTime} WIB</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {formattedDate}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white leading-snug truncate">
                      {ev.title}
                    </h3>

                    {ev.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {ev.description}
                      </p>
                    )}

                    {ev.userName && (
                      <p className="text-[10px] text-zinc-500 pt-1">
                        Dibuat oleh: <span className="text-zinc-400 font-semibold">{ev.userName}</span>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 transition cursor-pointer shrink-0"
                    title="Hapus Agenda"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Pop-up Tambah Jadwal Baru */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#141414] border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl relative">
              
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarIcon size={16} className="text-amber-400" />
                  <span>Tambah Agenda Baru</span>
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Judul Agenda / Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Meeting Proyek Client A"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Tanggal *
                    </label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Jam *
                    </label>
                    <input
                      type="time"
                      required
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Keterangan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detail tempat, tautan meeting, atau catatan ringkas..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#1c1c1c] border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow"
                  >
                    {submitting && <RefreshCw size={12} className="animate-spin" />}
                    <span>{submitting ? "Menyimpan..." : "Simpan Agenda"}</span>
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