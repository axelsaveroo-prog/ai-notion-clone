"use client";

import { useState } from "react";
import { Plus, Calendar, User, Tag, ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  client: string;
  status: "todo" | "in_progress" | "done";
  assignedDate: string;
  dueDate: string;
  assignedBy: string;
}

export function TasksManager() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Review brand guidelines & assets",
      client: "AKASA LAND",
      status: "todo",
      assignedDate: "2026-09-01",
      dueDate: "2026-09-05",
      assignedBy: "Alex (Creative Dir)",
    },
    {
      id: "2",
      title: "Update legal contract details",
      client: "APERIO",
      status: "in_progress",
      assignedDate: "2026-09-02",
      dueDate: "2026-09-08",
      assignedBy: "Sarah (Operations)",
    },
  ]);

  // Form states for new task
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("AKASA LAND");
  const [dueDate, setDueDate] = useState("");
  const [assignedBy, setAssignedBy] = useState("You");
  const [selectedClientFilter, setSelectedClientFilter] = useState("ALL");

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      client,
      status: "todo",
      assignedDate: new Date().toISOString().split("T")[0],
      dueDate,
      assignedBy,
    };

    setTasks([newTask, ...tasks]);
    setTitle("");
    setDueDate("");
  };

  const moveTask = (id: string, newStatus: Task["status"]) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  const filteredTasks = selectedClientFilter === "ALL" 
    ? tasks 
    : tasks.filter(t => t.client === selectedClientFilter);

  const columns: { key: Task["status"]; label: string; border: string }[] = [
    { key: "todo", label: "To Do", border: "border-gray-800" },
    { key: "in_progress", label: "In Progress", border: "border-orange-500/30" },
    { key: "done", label: "Done", border: "border-green-500/30" },
  ];

  // Helper to generate Google Calendar link
  const getGoogleCalendarUrl = (task: Task) => {
    const text = encodeURIComponent(`[Task] ${task.title} (${task.client})`);
    const details = encodeURIComponent(`Assigned by: ${task.assignedBy}\nClient: ${task.client}`);
    const dates = `${task.dueDate.replace(/-/g, "")}/${task.dueDate.replace(/-/g, "")}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`;
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Task Creation & Filter Bar */}
      <div className="bg-[#161618] border border-[#27272a] p-5 rounded-3xl shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span>✨</span> Create New Task & Assignment
          </h3>
          <div className="flex gap-2">
            {["ALL", "AKASA LAND", "APERIO", "BALI FINE GALLERY"].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedClientFilter(c)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                  selectedClientFilter === c
                    ? "bg-[#f97316] text-black"
                    : "bg-[#222226] text-gray-400 hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={addTask} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="AKASA LAND">AKASA LAND</option>
            <option value="APERIO">APERIO</option>
            <option value="BALI FINE GALLERY">BALI FINE GALLERY</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            type="text"
            value={assignedBy}
            onChange={(e) => setAssignedBy(e.target.value)}
            placeholder="Assigned by..."
            className="px-3 py-2 bg-[#121214] border border-[#27272a] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="submit"
            className="bg-[#f97316] text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </form>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key} className={`bg-[#161618] p-4 rounded-3xl border ${col.border} flex flex-col gap-4 shadow-xl`}>
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                {col.label}
              </h4>
              <span className="text-[10px] bg-[#222226] text-orange-400 px-2 py-0.5 rounded-full font-semibold">
                {filteredTasks.filter((t) => t.status === col.key).length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {filteredTasks
                .filter((t) => t.status === col.key)
                .map((task) => (
                  <div key={task.id} className="bg-[#121214] p-4 rounded-2xl border border-[#27272a] shadow-inner flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-orange-500/15 text-orange-400 font-bold px-2.5 py-0.5 rounded-md">
                        {task.client}
                      </span>
                      <a
                        href={getGoogleCalendarUrl(task)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-orange-400 text-[10px] flex items-center gap-1 bg-[#1a1a1e] px-2 py-1 rounded-lg border border-[#27272a] transition-colors"
                        title="Add to Google Calendar"
                      >
                        <Calendar className="w-3 h-3 text-orange-400" />
                        <span>Sync</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <p className="text-xs font-semibold text-white leading-relaxed">{task.title}</p>

                    {/* Metadata: Assigned Dates & Assignor */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-[#27272a] text-[10px] text-gray-400">
                      <div className="flex items-center justify-between">
                        <span>Assigned by: <strong className="text-gray-300">{task.assignedBy}</strong></span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Start: {task.assignedDate}</span>
                        <span className="text-orange-400 font-medium">Due: {task.dueDate}</span>
                      </div>
                    </div>

                    {/* Action Shift Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#27272a]/50 text-[10px]">
                      {col.key !== "todo" && (
                        <button onClick={() => moveTask(task.id, "todo")} className="text-gray-400 hover:text-white">← To Do</button>
                      )}
                      {col.key !== "in_progress" && (
                        <button onClick={() => moveTask(task.id, "in_progress")} className="text-orange-400 hover:text-orange-300">In Progress</button>
                      )}
                      {col.key !== "done" && (
                        <button onClick={() => moveTask(task.id, "done")} className="text-green-400 hover:text-green-300 ml-auto">Done ✓</button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
