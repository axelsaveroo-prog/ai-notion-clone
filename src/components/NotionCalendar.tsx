"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, Plus, ExternalLink, ChevronLeft, ChevronRight, LayoutGrid, List, Clock } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  client: string;
  assignee: string;
}

export function NotionCalendar() {
  const [viewMode, setViewMode] = useState<"notion" | "embed">("notion");
  const [currentMonth, setCurrentMonth] = useState("September 2026");
  
  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: "1", title: "Akasa Land Strategy Review", date: "2026-09-05", time: "10:00 AM", client: "AKASA LAND", assignee: "You & Team" },
    { id: "2", title: "Aperio Brand Asset Audit", date: "2026-09-12", time: "02:00 PM", client: "APERIO", assignee: "You" },
    { id: "3", title: "Bali Fine Gallery Final Delivery", date: "2026-09-18", time: "11:30 AM", client: "BALI FINE GALLERY", assignee: "Team" },
  ]);

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newClient, setNewClient] = useState("AKASA LAND");
  const [newAssignee, setNewAssignee] = useState("You");

  const addEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;

    setEvents([
      ...events,
      {
        id: Date.now().toString(),
        title: newTitle,
        date: newDate,
        time: "09:00 AM",
        client: newClient,
        assignee: newAssignee,
      },
    ]);
    setNewTitle("");
    setNewDate("");
  };

  return (
    <div className="w-full flex flex-col gap-5">
      
      {/* Notion Database Header Controls */}
      <div className="bg-[#161618] border border-[#27272a] p-4 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        {/* Title & Month switcher */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#222226] border border-[#27272a] text-orange-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">Schedule Database</h3>
              <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-md font-semibold border border-orange-500/20">Notion View</span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span>{currentMonth}</span>
            </p>
          </div>
        </div>

        {/* View Switcher & Google Calendar Sync toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-[#121214] p-1 rounded-xl border border-[#27272a] flex items-center gap-1">
            <button
              onClick={() => setViewMode("notion")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "notion" ? "bg-[#f97316] text-black shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Workspace DB
            </button>
            <button
              onClick={() => setViewMode("embed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === "embed" ? "bg-[#f97316] text-black shadow-md" : "text-gray-400 hover:text-white"
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Google Sync Embed
            </button>
          </div>
        </div>

      </div>

      {/* Main Content Area: Notion Database vs Live Google Calendar Embed */}
      {viewMode === "notion" ? (
        <div className="flex flex-col gap-4">
          
          {/* Quick Add Event Bar */}
          <form onSubmit={addEvent} className="bg-[#161618] border border-[#27272a] p-4 rounded-3xl shadow-xl grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event title (e.g. Client Briefing)..."
              className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <select
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="AKASA LAND">AKASA LAND</option>
              <option value="APERIO">APERIO</option>
              <option value="BALI FINE GALLERY">BALI FINE GALLERY</option>
            </select>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              type="submit"
              className="bg-[#f97316] text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <Plus className="w-4 h-4" /> Add Event Entry
            </button>
          </form>

          {/* Notion Table / Board Format */}
          <div className="bg-[#161618] border border-[#27272a] rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#27272a] flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Event / Deliverable</span>
              <span>Client Tag</span>
              <span>Date & Time</span>
              <span>Assignee</span>
            </div>

            <div className="divide-y divide-[#27272a]">
              {events.map((ev) => (
                <div key={ev.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#1a1a1e] transition-colors text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span className="font-semibold text-white">{ev.title}</span>
                  </div>

                  <span className="bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-md font-bold text-[10px] border border-orange-500/20">
                    {ev.client}
                  </span>

                  <div className="flex items-center gap-1.5 text-gray-300">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <span>{ev.date} ({ev.time})</span>
                  </div>

                  <span className="bg-[#222226] text-gray-300 px-3 py-1 rounded-lg border border-[#27272a] font-medium">
                    {ev.assignee}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        /* Native Google Calendar Dark Embedded View */
        <div className="bg-[#161618] border border-[#27272a] p-4 rounded-3xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-3 px-2">
            <p className="text-xs text-gray-400">Live Google Calendar Workspace Feed</p>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium bg-[#222226] px-3 py-1 rounded-lg border border-[#27272a]"
            >
              Open in Google <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          <div className="w-full h-[550px] rounded-2xl overflow-hidden border border-[#27272a] bg-[#121214]">
            {/* Embedded Google Calendar with dark filter aesthetics */}
            <iframe
              src="https://calendar.google.com/calendar/embed?src=en.indonesian%23holiday%40group.v.calendar.google.com&ctz=Asia%2FJakarta"
              style={{ border: 0 }}
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              className="w-full h-full opacity-90 invert-[0.9] hue-rotate-180"
            ></iframe>
          </div>
        </div>
      )}

    </div>
  );
}
