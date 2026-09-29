"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  Tag as TagIcon, 
  CheckCircle2, 
  Clock, 
  ChevronDown,
  Check
} from "lucide-react";

// Opsi pilihan ala Notion
const TYPE_OPTIONS = [
  { label: "Feeds", color: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20" },
  { label: "Story", color: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20" },
  { label: "Reels", color: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20" },
  { label: "Carousel", color: "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20" },
];

const CLIENT_OPTIONS = [
  { label: "Wearluca", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" },
  { label: "AKASA LAND", color: "bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20" },
  { label: "APERIO", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20" },
  { label: "BALI FINE GALLERY", color: "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20" },
];

const STATUS_OPTIONS = [
  { label: "To Do", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20" },
  { label: "Brief Ready", color: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" },
  { label: "In Progress", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20" },
  { label: "Editing", color: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20" },
  { label: "Edited", color: "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20" },
  { label: "Revisi", color: "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" },
];

const ASSIGNEE_OPTIONS = ["Alex", "Sarah", "Bintang Ebenheazer", "Teresa Ivo", "You"];

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const taskId = resolvedParams.id;

  // State nilai data
  const [title, setTitle] = useState("SEPT - Sandal dibuat - I/E");
  const [type, setType] = useState("Others");
  const [client, setClient] = useState("Wearluca");
  const [status, setStatus] = useState("Editing");
  const [assignee, setAssignee] = useState("Alex");
  const [due, setDue] = useState("2026-09-15");
  const [content, setContent] = useState(`Fun content bagaimana sandal anak dibuat video carousel
Slide 1
visual: semua bahan2 muncul di mangkuk terus di aduk
copywriting: Bagaimana sandal da sepatu anak dibuat bahan bahan
• lentur
• warna cakep
• tahan lama
• outsole kokoh
• sol empuk
• jahitan rapi

Slide 2
dari bahan mangkuk dituang lalu muncul asap
copywriting: puff puff
muncul beberapa sandal WEARLUCA`);

  // State menu popover dropdown yang sedang aktif
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const currentType = TYPE_OPTIONS.find((t) => t.label === type) || TYPE_OPTIONS[2];
  const currentClient = CLIENT_OPTIONS.find((c) => c.label === client) || CLIENT_OPTIONS[0];
  const currentStatus = STATUS_OPTIONS.find((s) => s.label === status) || STATUS_OPTIONS[2];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-zinc-200 p-8 pb-32">
      {/* Tombol Kembali */}
      <div className="max-w-4xl mx-auto mb-6">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Task Board
        </Link>
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
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-3xl font-bold text-white mb-6 tracking-tight focus:outline-none focus:border-b focus:border-zinc-700 pb-1"
          placeholder="Task title..."
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${currentType.color}`}
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
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-zinc-800 transition-colors"
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
              onClick={() => setOpenDropdown(openDropdown === "client" ? null : "client")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${currentClient.color}`}
            >
              {client}
              <ChevronDown size={13} className="opacity-70" />
            </button>

            {openDropdown === "client" && (
              <div className="absolute left-32 top-8 z-50 w-52 bg-[#1F1F1F] border border-zinc-800 rounded-lg p-1.5 shadow-2xl space-y-1">
                {CLIENT_OPTIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setClient(item.label);
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-zinc-800 transition-colors"
                  >
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    {client === item.label && <Check size={14} className="text-zinc-400" />}
                  </button>
                ))}
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${currentStatus.color}`}
            >
              {status}
              <ChevronDown size={13} className="opacity-70" />
            </button>

            {openDropdown === "status" && (
              <div className="absolute left-32 top-8 z-50 w-44 bg-[#1F1F1F] border border-zinc-800 rounded-lg p-1.5 shadow-2xl space-y-1">
                {STATUS_OPTIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setStatus(item.label);
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left hover:bg-zinc-800 transition-colors"
                  >
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${item.color}`}>
                      {item.label}
                    </span>
                    {status === item.label && <Check size={14} className="text-zinc-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PROPERTY: ASSIGNEE */}
          <div className="flex items-center relative">
            <span className="flex items-center gap-2 text-zinc-400 w-32 font-medium">
              <UserIcon size={15} /> Assignee
            </span>
            <button
              onClick={() => setOpenDropdown(openDropdown === "assignee" ? null : "assignee")}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-colors"
            >
              <div className="w-4 h-4 rounded-full bg-zinc-700 text-[10px] flex items-center justify-center font-bold">
                {assignee[0]}
              </div>
              {assignee}
              <ChevronDown size={13} className="text-zinc-400" />
            </button>

            {openDropdown === "assignee" && (
              <div className="absolute left-32 top-8 z-50 w-48 bg-[#1F1F1F] border border-zinc-800 rounded-lg p-1 shadow-2xl space-y-0.5">
                {ASSIGNEE_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setAssignee(item);
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded text-xs text-left text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-zinc-700 text-[10px] flex items-center justify-center font-bold">
                        {item[0]}
                      </div>
                      <span>{item}</span>
                    </div>
                    {assignee === item && <Check size={14} className="text-zinc-400" />}
                  </button>
                ))}
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
              onChange={(e) => setDue(e.target.value)}
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
            <span className="text-[11px] text-zinc-500">Auto-saved</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="w-full bg-[#181818] border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-sm leading-relaxed focus:outline-none focus:border-zinc-600 transition-colors resize-y"
            placeholder="Tulis brief tugas, instruksi video, atau catatan pekerjaan di sini..."
          />
        </div>
      </div>
    </div>
  );
}