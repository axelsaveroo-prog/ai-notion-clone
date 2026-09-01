"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Calendar, User, ArrowRight, X } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className={`pointer-events-auto bg-[#141416]/90 backdrop-blur-xl border border-[#222226] rounded-full shadow-2xl flex items-center transition-all duration-300 ease-out ${
        isAiOpen ? "px-4 py-2 w-full max-w-sm sm:max-w-md" : "px-3 py-2 gap-2"
      }`}>
        {isAiOpen ? (
          <form onSubmit={(e) => { e.preventDefault(); setPrompt(""); setIsAiOpen(false); }} className="flex items-center gap-2 w-full">
            <Sparkles className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI command center..."
              className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-none px-1"
            />
            <button type="submit" className="bg-white text-black font-medium px-3 py-1 rounded-full text-xs shrink-0 hover:bg-gray-200 transition-colors">
              Run
            </button>
            <button type="button" onClick={() => setIsAiOpen(false)} className="text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <>
            <Link href="/" className={`p-2.5 rounded-full transition-colors ${pathname === "/" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Home className="w-4 h-4" />
            </Link>
            <Link href="/tasks" className={`p-2.5 rounded-full transition-colors ${pathname === "/tasks" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <CheckSquare className="w-4 h-4" />
            </Link>
            <button type="button" onClick={() => setIsAiOpen(true)} className="p-3 rounded-full shadow-md bg-white text-black hover:bg-gray-200 transition-transform active:scale-95">
              <Sparkles className="w-4 h-4" />
            </button>
            <Link href="/calendar" className={`p-2.5 rounded-full transition-colors ${pathname === "/calendar" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Calendar className="w-4 h-4" />
            </Link>
            <Link href="/user" className={`p-2.5 rounded-full transition-colors ${pathname === "/user" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <User className="w-4 h-4" />
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
