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
      <nav className={`pointer-events-auto bg-[#161618]/95 backdrop-blur-md border border-[#27272a] rounded-full shadow-2xl flex items-center transition-all duration-300 ease-out ${
        isAiOpen ? "px-4 py-2 w-full max-w-sm sm:max-w-md" : "px-4 py-2.5 gap-3"
      }`}>
        {isAiOpen ? (
          <form onSubmit={(e) => { e.preventDefault(); setPrompt(""); setIsAiOpen(false); }} className="flex items-center gap-2 w-full">
            <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI command center..."
              className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-none px-1"
            />
            <button type="submit" className="bg-[#f97316] text-black p-1.5 rounded-full shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setIsAiOpen(false)} className="text-gray-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <>
            <Link href="/" className={`p-2.5 rounded-full ${pathname === "/" ? "bg-[#f97316] text-black" : "text-gray-400 hover:text-white"}`}>
              <Home className="w-5 h-5" />
            </Link>
            <Link href="/tasks" className={`p-2.5 rounded-full ${pathname === "/tasks" ? "bg-[#f97316] text-black" : "text-gray-400 hover:text-white"}`}>
              <CheckSquare className="w-5 h-5" />
            </Link>
            <button type="button" onClick={() => setIsAiOpen(true)} className="p-3.5 rounded-full shadow-lg scale-110 bg-[#f97316] text-black font-bold">
              <Sparkles className="w-5 h-5" />
            </button>
            <Link href="/calendar" className={`p-2.5 rounded-full ${pathname === "/calendar" ? "bg-[#f97316] text-black" : "text-gray-400 hover:text-white"}`}>
              <Calendar className="w-5 h-5" />
            </Link>
            <Link href="/user" className={`p-2.5 rounded-full ${pathname === "/user" ? "bg-[#f97316] text-black" : "text-gray-400 hover:text-white"}`}>
              <User className="w-5 h-5" />
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
