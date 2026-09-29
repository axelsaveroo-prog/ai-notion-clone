"use client";

import { useState, useEffect, useRef } from "react";
import { StickyNote, Plus, X, GripHorizontal } from "lucide-react";

interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

const NOTE_COLORS = [
  { bg: "bg-[#18181b]", border: "border-zinc-700/80", dot: "bg-zinc-400" },
  { bg: "bg-[#272015]", border: "border-amber-900/60", dot: "bg-amber-500" },
  { bg: "bg-[#14231b]", border: "border-emerald-950/80", dot: "bg-emerald-500" },
  { bg: "bg-[#231728]", border: "border-purple-950/80", dot: "bg-purple-400" },
];

export function StickyNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Muat data sticky notes dari local storage
  useEffect(() => {
    const saved = localStorage.getItem("SIKA_STICKY_NOTES");
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch {
        setNotes([]);
      }
    } else {
      // Default sticky note contoh pertama kali
      setNotes([
        {
          id: "default-note-1",
          text: "📌 Reminder: Review draft video reels Wearluca sebelum jam 4 sore.",
          x: 40,
          y: 120,
          color: "bg-[#272015] border-amber-900/60",
        },
      ]);
    }
  }, []);

  // 2. Simpan setiap perubahan ke local storage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    localStorage.setItem("SIKA_STICKY_NOTES", JSON.stringify(updatedNotes));
  };

  // Tambah note baru
  const addNote = () => {
    const randomColor = NOTE_COLORS[notes.length % NOTE_COLORS.length];
    const newNote: Note = {
      id: "note-" + Date.now(),
      text: "",
      x: 60 + (notes.length % 5) * 25,
      y: 140 + (notes.length % 5) * 25,
      color: `${randomColor.bg} ${randomColor.border}`,
    };
    saveNotes([...notes, newNote]);
    setIsOpen(true);
  };

  // Hapus note
  const deleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

  // Ubah teks isi note
  const updateNoteText = (id: string, text: string) => {
    saveNotes(notes.map((n) => (n.id === id ? { ...n, text } : n)));
  };

  // Logika Dragging
  const handleMouseDown = (e: React.MouseEvent, note: Note) => {
    setActiveDragId(note.id);
    dragOffset.current = {
      x: e.clientX - note.x,
      y: e.clientY - note.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragId) return;

      setNotes((prev) =>
        prev.map((n) => {
          if (n.id === activeDragId) {
            const newX = Math.max(10, Math.min(window.innerWidth - 240, e.clientX - dragOffset.current.x));
            const newY = Math.max(10, Math.min(window.innerHeight - 150, e.clientY - dragOffset.current.y));
            return { ...n, x: newX, y: newY };
          }
          return n;
        })
      );
    };

    const handleMouseUp = () => {
      if (activeDragId) {
        localStorage.setItem("SIKA_STICKY_NOTES", JSON.stringify(notes));
        setActiveDragId(null);
      }
    };

    if (activeDragId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeDragId, notes]);

  return (
    <>
      {/* RENDER STICKY NOTES BEBAS GESER */}
      {isOpen &&
        notes.map((note) => (
          <div
            key={note.id}
            style={{ left: `${note.x}px`, top: `${note.y}px` }}
            className={`fixed z-40 w-60 rounded-2xl border p-3 shadow-2xl backdrop-blur-md transition-shadow select-none ${
              note.color
            } ${activeDragId === note.id ? "shadow-black/70 scale-[1.02] cursor-grabbing" : "hover:border-zinc-500/50"}`}
          >
            {/* Header / Drag Handle */}
            <div
              onMouseDown={(e) => handleMouseDown(e, note)}
              className="flex items-center justify-between pb-2 border-b border-white/5 cursor-grab active:cursor-grabbing text-zinc-400"
            >
              <div className="flex items-center gap-1.5 opacity-60">
                <GripHorizontal size={14} />
                <span className="text-[10px] tracking-wider uppercase font-semibold">Note</span>
              </div>
              <button
                onClick={() => deleteNote(note.id)}
                className="text-zinc-500 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Hapus Note"
              >
                <X size={13} />
              </button>
            </div>

            {/* Input Konten Teks */}
            <textarea
              value={note.text}
              onChange={(e) => updateNoteText(note.id, e.target.value)}
              placeholder="Write a reminder..."
              rows={4}
              className="w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none pt-2 font-normal leading-relaxed selection:bg-zinc-700"
            />
          </div>
        ))}

      {/* FLOATING ACTION BUTTON DI POJOK KANAN BAWAH */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        {/* Toggle sembunyikan / perlihatkan jika ada notes */}
        {notes.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 rounded-full bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-white border border-[#27272a] flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer"
            title={isOpen ? "Sembunyikan Notes" : "Tampilkan Notes"}
          >
            <StickyNote size={15} className={isOpen ? "opacity-100" : "opacity-40"} />
          </button>
        )}

        {/* Tombol Tambah Note (+) Kecil Sesuai Tema */}
        <button
          onClick={addNote}
          className="h-9 px-3 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center gap-1.5 shadow-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          title="Tambah Sticky Note"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Note</span>
        </button>
      </div>
    </>
  );
}