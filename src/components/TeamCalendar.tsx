"use client";

import { useState } from "react";
import { Calendar, Plus, Users, ExternalLink } from "lucide-react";

interface EventItem {
  id: string;
  title: string;
  date: string;
  assignee: string;
  client: string;
}

export function TeamCalendar() {
  const [events, setEvents] = useState<EventItem[]>([
    { id: "1", title: "Client Strategy Meeting", date: "2026-09-05", assignee: "You & Team", client: "AKASA LAND" },
    { id: "2", title: "Design Review & Audit", date: "2026-09-10", assignee: "You", client: "APERIO" },
  ]);

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("You");

  const addEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle) return;
    setEvents([...events, {
      id: Date.now().toString(),
      title: newEventTitle,
      date: "2026-09-15",
      assignee: newAssignee,
      client: "General"
    }]);
    setNewEventTitle("");
  };

  return (
    <div className="w-full bg-[#161618] border border-[#27272a] p-5 rounded-2xl shadow-xl flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <span>📅</span> Sika Team Schedule
          </h3>
          <p className="text-xs text-gray-400">Synced with Google Calendar & team assignments.</p>
        </div>

        {/* Google Calendar Sync Button */}
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#222226] border border-[#27272a] text-orange-400 hover:text-orange-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Google Calendar
        </a>
      </div>

      {/* Add Event Form */}
      <form onSubmit={addEvent} className="bg-[#121214] p-3 rounded-xl border border-[#27272a] flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newEventTitle}
          onChange={(e) => setNewEventTitle(e.target.value)}
          placeholder="New schedule title..."
          className="flex-1 px-3 py-2 bg-[#1a1a1e] border border-[#27272a] rounded-lg text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <select
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          className="px-3 py-2 bg-[#1a1a1e] border border-[#27272a] rounded-lg text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="You">Assign: You</option>
          <option value="Team">Assign: Entire Team</option>
          <option value="You & Team">Assign: You & Team</option>
        </select>
        <button
          type="submit"
          className="bg-[#f97316] text-black font-semibold px-4 py-2 rounded-lg text-xs hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </form>

      {/* Scheduled Events List */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Upcoming Schedule</h4>
        {events.map((ev) => (
          <div key={ev.id} className="bg-[#121214] border border-[#27272a] p-3 rounded-xl flex items-center justify-between text-xs">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-white">{ev.title}</span>
              <div className="flex items-center gap-2 text-gray-400">
                <span className="text-orange-400 font-medium">{ev.client}</span>
                <span>•</span>
                <span>{ev.date}</span>
              </div>
            </div>
            <div className="bg-[#222226] text-gray-300 px-2.5 py-1 rounded-md border border-[#27272a] flex items-center gap-1.5 font-medium">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              {ev.assignee}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
