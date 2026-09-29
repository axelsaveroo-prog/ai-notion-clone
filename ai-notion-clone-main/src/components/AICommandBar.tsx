"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export function AICommandBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setResponseMessage("");

    try {
      const res = await fetch("/actions/ai-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResponseMessage(data.message || "Executed successfully!");
    } catch {
      setResponseMessage("Error processing command.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full relative">
      <form onSubmit={handleSubmit} className="flex items-center bg-[#161618] border border-[#27272a] rounded-full px-3.5 py-1.5 shadow-inner focus-within:border-orange-500 transition-colors">
        <Sparkles className="w-4 h-4 text-orange-400 mr-2 shrink-0" />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI or type command..."
          className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#f97316] text-black p-1.5 rounded-full hover:bg-orange-600 disabled:opacity-50 transition-colors shrink-0 ml-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>
      {responseMessage && (
        <p className="text-[10px] text-orange-400 mt-1 px-3 font-medium">{responseMessage}</p>
      )}
    </div>
  );
}
