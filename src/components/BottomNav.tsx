"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Sparkles, Calendar, User, ArrowRight, X } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/actions/ai-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      await res.json();
      setPrompt("");
      setIsAiOpen(false);
    } catch {
      // Handle error gracefully
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto bg-[#161618]/95 backdrop-blur-md border border-[#27272a] rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-3 transition-all duration-300">
        
        {isAiOpen ? (
          /* Morphing State: Full Input Bar */
          <form onSubmit={handleAiSubmit} className="flex items-center gap-2 w-72 sm:w-80 px-2 py-1 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI anything..."
              className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#f97316] text-black p-1.5 rounded-full hover:bg-orange-600 transition-colors shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAiOpen(false)}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Normal State: Standard Icon Bar */
          <>
            <Link href="/" className={`p-2.5 rounded-full transition-all ${pathname === "/" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"}`} title="Home">
              <Home className="w-5 h-5" />
            </Link>

            <Link href="/tasks" className={`p-2.5 rounded-full transition-all ${pathname === "/tasks" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"}`} title="Tasks">
              <CheckSquare className="w-5 h-5" />
            </Link>

            {/* Center AI Toggle Button */}
            <button
              type="button"
              onClick={() => setIsAiOpen(true)}
              className="p-3.5 rounded-full transition-all shadow-lg scale-110 bg-[#f97316] text-black font-bold hover:bg-orange-600 flex items-center justify-center"
              title="Open AI Prompt"
            >
              <Sparkles className="w-5 h-5" />
            </button>

            <Link href="/calendar" className={`p-2.5 rounded-full transition-all ${pathname === "/calendar" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"}`} title="Calendar">
              <Calendar className="w-5 h-5" />
            </Link>

            <Link href="/user" className={`p-2.5 rounded-full transition-all ${pathname === "/user" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"}`} title="User Profile">
              <User className="w-5 h-5" />
            </Link>
          </>
        )}

      </nav>
    </div>
  );
}
