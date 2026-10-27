"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Calendar, User, X } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav 
        style={{ transform: 'translateZ(0)' }}
        className={`pointer-events-auto bg-[#141416]/95 backdrop-blur-xl border border-[#222226] rounded-full shadow-2xl flex items-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isAiOpen ? "px-5 py-3 w-full max-w-sm sm:max-w-md scale-100" : "px-4 py-2.5 gap-3 sm:gap-4"
        }`}
      >
        {isAiOpen ? (
          <form 
            onSubmit={(e) => { e.preventDefault(); setPrompt(""); setIsAiOpen(false); }} 
            className="flex items-center gap-3 w-full"
          >
            <Sparkles className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI command center..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-zinc-500 focus:outline-none px-1 py-1"
            />
            <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium px-3.5 py-1.5 rounded-full text-xs shrink-0 transition-colors cursor-pointer">
              Run
            </button>
            <button type="button" onClick={() => setIsAiOpen(false)} className="text-zinc-400 hover:text-white p-1.5 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <>
            <Link href="/" className={`p-3 rounded-full transition-colors ${pathname === "/" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`} title="Beranda">
              <Home className="w-5 h-5" />
            </Link>
            <Link href="/tasks" className={`p-3 rounded-full transition-colors ${pathname === "/tasks" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`} title="Tasks">
              <CheckSquare className="w-5 h-5" />
            </Link>
            <button 
              type="button" 
              onClick={() => setIsAiOpen(true)} 
              className="p-3 rounded-full shadow-lg bg-zinc-100 hover:bg-white text-zinc-950 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
              title="Ask AI"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <Link href="/calendar" className={`p-3 rounded-full transition-colors ${pathname === "/calendar" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`} title="Kalender">
              <Calendar className="w-5 h-5" />
            </Link>
            <Link href="/user" className={`p-3 rounded-full transition-colors ${pathname === "/user" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`} title="Profil / Absensi">
              <User className="w-5 h-5" />
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
