"use client";

import { useState, useEffect, useRef } from "react";
import { StickyNote, Plus, X, GripHorizontal } from "lucide-react";

interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
}

type ResizeDirection = "left" | "right" | "bottom" | "corner";

const DEFAULT_WIDTH = 250;
const DEFAULT_HEIGHT = 180;
const MIN_WIDTH = 180;
const MIN_HEIGHT = 130;

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
  const [activeResize, setActiveResize] = useState<{ id: string; dir: ResizeDirection } | null>(null);
  const [activeFrontId, setActiveFrontId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;

  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStart = useRef<{
    mouseX: number;
    mouseY: number;
    width: number;
    height: number;
    noteX: number;
    noteY: number;
  }>({ mouseX: 0, mouseY: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, noteX: 0, noteY: 0 });

  // Pantau ukuran viewport agar sticky note tetap rapi di layar desktop & mobile
  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

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
          text: "Reminder: Review draft video reels Wearluca sebelum jam 4 sore.",
          x: 40,
          y: 120,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
          color: "bg-[#272015] border-amber-900/60",
        },
      ]);
    }
  }, []);

  // 2. Simpan setiap perubahan ke local storage
  const saveNotes = (updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    notesRef.current = updatedNotes;
    localStorage.setItem("SIKA_STICKY_NOTES", JSON.stringify(updatedNotes));
  };

  // Tambah note baru
  const addNote = () => {
    const randomColor = NOTE_COLORS[notes.length % NOTE_COLORS.length];
    const newId = "note-" + Date.now();
    const newNote: Note = {
      id: newId,
      text: "",
      x: 40 + (notes.length % 5) * 25,
      y: 120 + (notes.length % 5) * 25,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      color: `${randomColor.bg} ${randomColor.border}`,
    };
    saveNotes([...notes, newNote]);
    setActiveFrontId(newId);
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

  const getBoundedNoteMetrics = (note: Note) => {
    const maxW = viewport.width > 0 ? Math.max(MIN_WIDTH, viewport.width - 16) : 800;
    const maxH = viewport.height > 0 ? Math.max(MIN_HEIGHT, viewport.height - 16) : 800;
    const width = Math.min(Math.max(note.width ?? DEFAULT_WIDTH, MIN_WIDTH), maxW);
    const height = Math.min(Math.max(note.height ?? DEFAULT_HEIGHT, MIN_HEIGHT), maxH);
    const x = viewport.width > 0 ? Math.max(8, Math.min(note.x, viewport.width - width - 8)) : note.x;
    const y = viewport.height > 0 ? Math.max(8, Math.min(note.y, viewport.height - height - 8)) : note.y;
    return { x, y, width, height };
  };

  // Logika Dragging (Pointer: Mouse & Touch)
  const handleDragPointerDown = (e: React.PointerEvent, note: Note) => {
    e.preventDefault();
    const metrics = getBoundedNoteMetrics(note);
    setActiveFrontId(note.id);
    setActiveDragId(note.id);
    dragOffset.current = {
      x: e.clientX - metrics.x,
      y: e.clientY - metrics.y,
    };
  };

  // Logika Resizing / Stretch (Pointer: Mouse & Touch)
  const handleResizePointerDown = (e: React.PointerEvent, note: Note, dir: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    const metrics = getBoundedNoteMetrics(note);
    setActiveFrontId(note.id);
    setActiveResize({ id: note.id, dir });
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: metrics.width,
      height: metrics.height,
      noteX: metrics.x,
      noteY: metrics.y,
    };
  };

  useEffect(() => {
    if (!activeDragId && !activeResize) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (activeDragId) {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === activeDragId) {
              const maxW = Math.max(MIN_WIDTH, window.innerWidth - 16);
              const maxH = Math.max(MIN_HEIGHT, window.innerHeight - 16);
              const w = Math.min(Math.max(n.width ?? DEFAULT_WIDTH, MIN_WIDTH), maxW);
              const h = Math.min(Math.max(n.height ?? DEFAULT_HEIGHT, MIN_HEIGHT), maxH);
              const maxX = Math.max(8, window.innerWidth - w - 8);
              const maxY = Math.max(8, window.innerHeight - h - 8);
              const newX = Math.max(8, Math.min(maxX, e.clientX - dragOffset.current.x));
              const newY = Math.max(8, Math.min(maxY, e.clientY - dragOffset.current.y));
              return { ...n, x: newX, y: newY };
            }
            return n;
          })
        );
      } else if (activeResize) {
        const deltaX = e.clientX - resizeStart.current.mouseX;
        const deltaY = e.clientY - resizeStart.current.mouseY;

        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === activeResize.id) {
              const maxAllowedW = Math.max(MIN_WIDTH, window.innerWidth - resizeStart.current.noteX - 8);
              const maxAllowedH = Math.max(MIN_HEIGHT, window.innerHeight - resizeStart.current.noteY - 8);

              let nextX = resizeStart.current.noteX;
              let nextWidth = resizeStart.current.width;

              if (activeResize.dir === "left") {
                const maxExpandLeft = Math.max(0, resizeStart.current.noteX - 8);
                const maxShrinkRight = resizeStart.current.width - MIN_WIDTH;
                const clampedDelta = Math.max(-maxExpandLeft, Math.min(maxShrinkRight, deltaX));
                nextX = Math.round(resizeStart.current.noteX + clampedDelta);
                nextWidth = Math.round(resizeStart.current.width - clampedDelta);
              } else if (activeResize.dir === "right" || activeResize.dir === "corner") {
                nextWidth = Math.round(
                  Math.max(MIN_WIDTH, Math.min(maxAllowedW, resizeStart.current.width + deltaX))
                );
              } else {
                nextWidth = n.width ?? resizeStart.current.width;
              }

              const nextHeight =
                activeResize.dir === "bottom" || activeResize.dir === "corner"
                  ? Math.round(Math.max(MIN_HEIGHT, Math.min(maxAllowedH, resizeStart.current.height + deltaY)))
                  : n.height ?? resizeStart.current.height;

              return {
                ...n,
                x: nextX,
                y: resizeStart.current.noteY,
                width: nextWidth,
                height: nextHeight,
              };
            }
            return n;
          })
        );
      }
    };

    const handlePointerUp = () => {
      localStorage.setItem("SIKA_STICKY_NOTES", JSON.stringify(notesRef.current));
      setActiveDragId(null);
      setActiveResize(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [activeDragId, activeResize]);

  return (
    <>
      {/* RENDER STICKY NOTES BEBAS GESER & STRETCH */}
      {isOpen &&
        notes.map((note) => {
          const { x, y, width, height } = getBoundedNoteMetrics(note);
          const isDragging = activeDragId === note.id;
          const isResizing = activeResize?.id === note.id;
          const isFront = activeFrontId === note.id;

          return (
            <div
              key={note.id}
              onPointerDown={() => setActiveFrontId(note.id)}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
              className={`group fixed flex flex-col rounded-2xl border p-3 shadow-2xl backdrop-blur-md transition-shadow select-none ${
                isFront ? "z-[45]" : "z-40"
              } ${note.color} ${
                isDragging
                  ? "shadow-black/70 scale-[1.01] cursor-grabbing"
                  : isResizing
                  ? "shadow-black/70 border-zinc-400/60"
                  : "hover:border-zinc-500/50"
              }`}
            >
              {/* Header / Drag Handle */}
              <div
                onPointerDown={(e) => handleDragPointerDown(e, note)}
                className="flex items-center justify-between pb-2 border-b border-white/5 cursor-grab active:cursor-grabbing text-zinc-400 touch-none shrink-0"
              >
                <div className="flex items-center gap-1.5 opacity-60">
                  <GripHorizontal size={14} />
                  <span className="text-[10px] tracking-wider uppercase font-semibold">Note</span>
                  {isResizing && (
                    <span className="text-[9px] font-mono text-zinc-400 ml-1">
                      {width}×{height}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => deleteNote(note.id)}
                  className="text-zinc-500 hover:text-white p-0.5 rounded transition cursor-pointer"
                  title="Delete Note"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Input Konten Teks */}
              <textarea
                value={note.text}
                onChange={(e) => updateNoteText(note.id, e.target.value)}
                placeholder="Write a reminder..."
                className="flex-1 w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none pt-2 pr-1.5 pb-1.5 font-normal leading-relaxed select-text selection:bg-zinc-700 overflow-y-auto no-scrollbar"
              />

              {/* Left Edge Resize Handle (Melebar / Mengecil ke Kiri) */}
              <div
                onPointerDown={(e) => handleResizePointerDown(e, note, "left")}
                title="Drag to resize width"
                className="absolute top-3 bottom-4 left-0 w-2 cursor-ew-resize touch-none flex items-center justify-center group/edge-l"
              >
                <div className="w-[2px] h-8 rounded-full bg-white/0 group-hover/edge-l:bg-white/30 transition-colors" />
              </div>

              {/* Right Edge Resize Handle (Melebar / Mengecil Horizontal) */}
              <div
                onPointerDown={(e) => handleResizePointerDown(e, note, "right")}
                title="Drag to resize width"
                className="absolute top-3 bottom-4 right-0 w-2 cursor-ew-resize touch-none flex items-center justify-center group/edge-r"
              >
                <div className="w-[2px] h-8 rounded-full bg-white/0 group-hover/edge-r:bg-white/30 transition-colors" />
              </div>

              {/* Bottom Edge Resize Handle (Meninggi / Memendek Vertikal) */}
              <div
                onPointerDown={(e) => handleResizePointerDown(e, note, "bottom")}
                title="Drag to resize height"
                className="absolute left-3 right-4 bottom-0 h-2 cursor-ns-resize touch-none flex items-center justify-center group/edge-b"
              >
                <div className="h-[2px] w-8 rounded-full bg-white/0 group-hover/edge-b:bg-white/30 transition-colors" />
              </div>

              {/* Bottom-Right Corner Resize Handle (Stretch Width & Height) */}
              <div
                onPointerDown={(e) => handleResizePointerDown(e, note, "corner")}
                title="Drag to stretch note"
                className="absolute bottom-0.5 right-0.5 w-5 h-5 cursor-nwse-resize touch-none flex items-end justify-end p-1.5 text-zinc-500/60 group-hover:text-zinc-300 transition-colors"
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M9 3L3 9M9 7L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          );
        })}

      {/* FLOATING ACTION BUTTON DI POJOK KANAN BAWAH */}
      <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2">
        {/* Toggle sembunyikan / perlihatkan jika ada notes */}
        {notes.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 rounded-full bg-[#18181b] hover:bg-[#27272a] text-zinc-300 hover:text-white border border-[#27272a] flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer"
            title={isOpen ? "Hide Notes" : "Show Notes"}
          >
            <StickyNote size={15} className={isOpen ? "opacity-100" : "opacity-40"} />
          </button>
        )}

        {/* Tombol Tambah Note (+) Kecil Sesuai Tema */}
        <button
          onClick={addNote}
          className="h-9 px-3 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center gap-1.5 shadow-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          title="Add Sticky Note"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Note</span>
        </button>
      </div>
    </>
  );
}