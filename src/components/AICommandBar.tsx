"use client";

import { useState } from "react";
import { handleAITaskCommand } from "@/actions/ai-tasks";

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
      const res = await handleAITaskCommand(prompt);
      setResponseMessage(res.message);
    } catch (error) {
      setResponseMessage("Something went wrong executing the command.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200 my-4 max-w-xl">
      <h3 className="font-semibold text-gray-800 mb-2">🤖 AI Workspace Assistant</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Mark all tasks for Project Alpha as done"
          className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Run AI"}
        </button>
      </form>
      {responseMessage && (
        <p className="text-xs text-gray-600 mt-2 font-medium">{responseMessage}</p>
      )}
    </div>
  );
}
