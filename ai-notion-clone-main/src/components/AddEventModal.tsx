"use client";

import { useEffect, useState } from "react";
import { createCalendarEvent, getUsersAction } from "@/actions/actions";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEventModal({ isOpen, onClose, onSuccess }: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch daftar user asli yang sudah terdaftar saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      async function loadUsers() {
        const data = await getUsersAction();
        setUsers(data);
      }
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;

    setLoading(true);
    try {
      await createCalendarEvent({
        title,
        client,
        date,
        time,
        assignees: selectedAssignees,
      });

      // Reset form
      setTitle("");
      setClient("");
      setDate("");
      setTime("");
      setSelectedAssignees([]);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Gagal menambahkan event:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (userName: string) => {
    if (selectedAssignees.includes(userName)) {
      setSelectedAssignees(selectedAssignees.filter((name) => name !== userName));
    } else {
      setSelectedAssignees([...selectedAssignees, userName]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#141414] border border-zinc-800 p-6 text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Tambah Event Baru</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Judul Event *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Meeting Proyek A"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nama Klien / Tim</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Contoh: Internal / PT SIKA"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Tanggal *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Jam</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Pilih Anggota (Assignees)</label>
            {users.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-2 bg-zinc-900/50 rounded border border-zinc-800">
                Belum ada anggota lain yang mendaftar.
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1 bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
                {users.map((u) => {
                  const displayName = u.name || u.email;
                  const isSelected = selectedAssignees.includes(displayName);
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleAssignee(displayName)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex justify-between items-center transition ${
                        isSelected
                          ? "bg-blue-600 text-white font-medium"
                          : "hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <span>{displayName}</span>
                      {isSelected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium hover:bg-zinc-700 text-zinc-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-medium hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}