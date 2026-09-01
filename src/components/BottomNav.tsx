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
            className="flex items-center gap-3 w-full animate-fade-in"
          >
            <Sparkles className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI command center..."
              className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-gray-500 focus:outline-none px-1 py-1"
            />
            <button type="submit" className="bg-white text-black font-semibold px-4 py-1.5 rounded-full text-xs shrink-0 hover:bg-gray-200 transition-colors">
              Run
            </button>
            <button type="button" onClick={() => setIsAiOpen(false)} className="text-gray-400 hover:text-white p-1.5">
              <X className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <>
            <Link href="/" className={`p-3 rounded-full transition-colors ${pathname === "/" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Home className="w-5 h-5" />
            </Link>
            <Link href="/tasks" className={`p-3 rounded-full transition-colors ${pathname === "/tasks" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <CheckSquare className="w-5 h-5" />
            </Link>
            <button type="button" onClick={() => setIsAiOpen(true)} className="p-3.5 rounded-full shadow-lg bg-white text-black hover:bg-gray-200 transition-transform active:scale-95">
              <Sparkles className="w-6 h-6" />
            </button>
            <Link href="/calendar" className={`p-3 rounded-full transition-colors ${pathname === "/calendar" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Calendar className="w-5 h-5" />
            </Link>
            <Link href="/user" className={`p-3 rounded-full transition-colors ${pathname === "/user" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <User className="w-5 h-5" />
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}          <>
            <Link href="/" className={`p-3 rounded-full transition-colors ${pathname === "/" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Home className="w-5 h-5" />
            </Link>
            <Link href="/tasks" className={`p-3 rounded-full transition-colors ${pathname === "/tasks" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <CheckSquare className="w-5 h-5" />
            </Link>
            <button type="button" onClick={() => setIsAiOpen(true)} className="p-3.5 rounded-full shadow-lg bg-white text-black hover:bg-gray-200 transition-transform active:scale-95">
              <Sparkles className="w-6 h-6" />
            </button>
            <Link href="/calendar" className={`p-3 rounded-full transition-colors ${pathname === "/calendar" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <Calendar className="w-5 h-5" />
            </Link>
            <Link href="/user" className={`p-3 rounded-full transition-colors ${pathname === "/user" ? "bg-[#222226] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1e]"}`}>
              <User className="w-5 h-5" />
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
