"use client";

import { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Tag, 
  Share2, 
  Copy, 
  Check, 
  Globe, 
  FileText,
  Printer,
  Lock,
  ExternalLink
} from "lucide-react";

function MomContent({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const isPublicView = searchParams.get("view") === "public";

  const [title, setTitle] = useState("Minutes of Meeting (MoM)");
  const [client, setClient] = useState("APERIO");
  const [date, setDate] = useState("2026-09-15");
  const [time, setTime] = useState("10:00");
  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // State Share Modal
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Ambil data schedule terkait
    const savedEvents = localStorage.getItem("SIKA_CALENDAR_EVENTS");
    if (savedEvents) {
      try {
        const events = JSON.parse(savedEvents);
        const match = events.find((e: any) => e.id === eventId);
        if (match) {
          setTitle(`MoM: ${match.title}`);
          setClient(match.client || "General");
          setDate(match.date || "2026-09-15");
          setTime(match.time || "10:00");
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Ambil konten MoM
    const savedMom = localStorage.getItem(`MOM_NOTES_${eventId}`);
    if (savedMom) {
      setContent(savedMom);
    } else {
      setContent(`## Agenda Pembahasan
1. Evaluasi deliverables dan progress campaign client
2. Review final timeline dan assets delivery

## Keputusan & Kesepakatan Rapat
• Draft asset disetujui dengan penyesuaian minor
• Timeline penyerahan final disepakati sesuai jadwal

## Action Items / PIC
• [@Team Creative] Export master file hi-res
• [@Client Approval] Konfirmasi preview asset revisi`);
    }
  }, [eventId]);

  const handleSaveContent = (val: string) => {
    if (isPublicView) return;
    setContent(val);
    localStorage.setItem(`MOM_NOTES_${eventId}`, val);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  // URL share khusus klien (dengan parameter ?view=public)
  const clientShareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/mom/${eventId}?view=public`
    : `https://sika.site/mom/${eventId}?view=public`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(clientShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    setIsShareOpen(false);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-zinc-200 p-4 sm:p-10 pb-32 print:bg-white print:p-0 print:text-black">
      
      {/* HEADER BAR */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        {isPublicView ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <Lock size={12} className="text-zinc-500" />
            <span>Public Document • Read-Only</span>
          </div>
        ) : (
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Kembali ke Kalender
          </Link>
        )}

        <div className="flex items-center gap-2">
          {/* Tombol Cetak / PDF */}
          <button
            onClick={handlePrint}
            className="h-8 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Cetak Dokumen ke PDF"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>

          {/* Tombol Share Link untuk Tim Internal */}
          {!isPublicView && (
            <div className="relative">
              <button
                onClick={() => setIsShareOpen(!isShareOpen)}
                className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Share2 size={13} />
                <span>Share Client Link</span>
              </button>

              {isShareOpen && (
                <div className="absolute right-0 top-10 z-50 w-84 bg-[#161618] border border-zinc-800 rounded-2xl p-4 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Client Web Link (Notion Style)</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 leading-relaxed">
                    Tautan ini terkunci dalam mode <strong>Read-Only</strong> dan tombol navigasi disembunyikan agar aman dibagikan ke client.
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#1c1c1f] border border-zinc-800 rounded-xl p-1.5">
                    <input
                      readOnly
                      value={clientShareUrl}
                      className="bg-transparent text-[11px] text-zinc-300 flex-1 px-1.5 focus:outline-none truncate font-mono"
                    />
                    <button
                      onClick={copyShareLink}
                      className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <a
                    href={clientShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition pt-1"
                  >
                    <span>Buka preview tampilan client</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DOKUMEN NOTULEN */}
      <div className="max-w-4xl mx-auto bg-[#141414] border border-zinc-800/80 rounded-3xl p-6 sm:p-12 shadow-2xl space-y-8 print:bg-white print:border-none print:p-0 print:shadow-none print:text-black">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-2 print:text-zinc-600">
            <FileText size={14} />
            <span className="uppercase font-semibold tracking-wider text-[10px]">Official Minutes of Meeting</span>
            {!isPublicView && (
              <>
                <span className="print:hidden">•</span>
                <span className="text-zinc-400 print:hidden">{isSaved ? "Tersimpan otomatis" : "Auto-saved"}</span>
              </>
            )}
          </div>

          {isPublicView ? (
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight pb-1 print:text-black">
              {title}
            </h1>
          ) : (
            <>
              {/* Tampilan input di browser */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white tracking-tight focus:outline-none border-b border-transparent focus:border-zinc-700 pb-1 print:hidden"
                placeholder="Judul Rapat / MoM..."
              />
              {/* Judul khusus saat di-print */}
              <h1 className="hidden print:block text-2xl font-bold text-black pb-2">
                {title}
              </h1>
            </>
          )}
        </div>

        {/* Properties Grid ala Notion (Hanya Date, Time, dan Client Tag) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 pb-6 border-b border-zinc-800/80 text-xs print:border-zinc-300 print:py-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-zinc-400 font-medium print:text-zinc-600">
              <CalendarIcon size={14} /> Date:
            </span>
            <span className="text-zinc-200 font-mono print:text-black">{date}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-zinc-400 font-medium print:text-zinc-600">
              <Clock size={14} /> Time:
            </span>
            <span className="text-zinc-200 font-mono print:text-black">{time} WIB</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-zinc-400 font-medium print:text-zinc-600">
              <Tag size={14} /> Client Tag:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium print:bg-zinc-100 print:text-black print:border-zinc-300">
              {client}
            </span>
          </div>
        </div>

        {/* Konten Notulen */}
        <div className="space-y-3 print:space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 print:text-zinc-700">
              Notulen & Hasil Rapat
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono print:text-zinc-500">
              Verified Studio Notes
            </span>
          </div>

          {isPublicView ? (
            /* Tampilan Read-Only Bersih */
            <div className="w-full bg-[#18181a]/50 border border-zinc-800/60 rounded-2xl p-6 text-zinc-200 font-mono text-sm leading-relaxed whitespace-pre-wrap print:bg-transparent print:border-none print:p-0 print:text-black print:text-xs">
              {content}
            </div>
          ) : (
            <>
              {/* Tampilan Textarea saat di browser internal */}
              <textarea
                value={content}
                onChange={(e) => handleSaveContent(e.target.value)}
                rows={18}
                placeholder="Tuliskan poin pembahasan, notulen, keputusan rapat, dan pembagian tugas di sini..."
                className="w-full bg-[#18181a] border border-zinc-800 rounded-2xl p-6 text-zinc-200 font-mono text-sm leading-relaxed focus:outline-none focus:border-zinc-600 transition-colors resize-y print:hidden"
              />
              {/* Tampilan teks rapi murni saat di-print ke kertas/PDF */}
              <div className="hidden print:block text-black font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {content}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F0F0F] text-zinc-400 p-10">Memuat notulen...</div>}>
      <MomContent eventId={resolvedParams.id} />
    </Suspense>
  );
}