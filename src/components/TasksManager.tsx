"use client";

import { useState } from "react";
import { Plus, Calendar, ExternalLink } from "lucide-react";

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
      assignedBy: "Alex",
    },
    {
      id: "2",
      title: "Update legal contract details",
      client: "APERIO",
      status: "in_progress",
      assignedDate: "2026-09-02",
      dueDate: "2026-09-08",
      assignedBy: "Sarah",
    },
  ]);

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

  const columns: { key: Task["status"]; label: string }[] = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  const getGoogleCalendarUrl = (task: Task) => {
    const text = encodeURIComponent(`[Task] ${task.title} (${task.client})`);
    const details = encodeURIComponent(`Assigned by: ${task.assignedBy}\nClient: ${task.client}`);
    const dates = `${task.dueDate.replace(/-/g, "")}/${task.dueDate.replace(/-/g, "")}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`;
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Creation & Filter Bar */}
      <div className="bg-[#121214] border border-[#222226] p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm text-white uppercase tracking-wide">
            ✨ Create New Task
          </h3>
          <div className="flex gap-1.5">
            {["ALL", "AKASA LAND", "APERIO", "BALI FINE GALLERY"].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedClientFilter(c)}
                className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  selectedClientFilter === c
                    ? "bg-white text-black"
                    : "bg-[#1a1a1e] text-gray-400 hover:text-white border border-[#222226]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={addTask} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="px-3 py-2 bg-[#161618] border border-[#222226] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
          />
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="px-3 py-2 bg-[#161618] border border-[#222226] rounded-xl text-xs text-gray-300 focus:outline-none focus:border-gray-500"
          >
            <option value="AKASA LAND">AKASA LAND</option>
            <option value="APERIO">APERIO</option>
            <option value="BALI FINE GALLERY">BALI FINE GALLERY</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 bg-[#161618] border border-[#222226] rounded-xl text-xs text-gray-300 focus:outline-none focus:border-gray-500"
          />
          <input
            type="text"
            value={assignedBy}
            onChange={(e) => setAssignedBy(e.target.value)}
            placeholder="Assigned by..."
            className="px-3 py-2 bg-[#161618] border border-[#222226] rounded-xl text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-gray-500"
          />
          <button
            type="submit"
            className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-xs hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </form>
      </div>

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key} className="bg-[#121214] p-4 rounded-2xl border border-[#222226] flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {col.label}
              </h4>
              <span className="text-[10px] bg-[#1a1a1e] text-gray-300 px-2 py-0.5 rounded font-medium border border-[#222226]">
                {filteredTasks.filter((t) => t.status === col.key).length}
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {filteredTasks
                .filter((t) => t.status === col.key)
                .map((task) => (
                  <div key={task.id} className="bg-[#161618] p-3.5 rounded-xl border border-[#222226] shadow-sm flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-[#1a1a1e] text-gray-300 font-medium px-2 py-0.5 rounded border border-[#222226]">
                        {task.client}
                      </span>
                      <a
                        href={getGoogleCalendarUrl(task)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white text-[10px] flex items-center gap-1 bg-[#121214] px-2 py-1 rounded border border-[#222226] transition-colors"
                        title="Add to Google Calendar"
                      >
                        <Calendar className="w-3 h-3 text-gray-300" />
                        <span>Sync</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <p className="text-xs font-normal text-white leading-relaxed">{task.title}</p>

                    <div className="flex flex-col gap-1 pt-2 border-t border-[#222226] text-[10px] text-gray-400">
                      <div>By: <strong className="text-gray-300">{task.assignedBy}</strong></div>
                      <div className="flex justify-between">
                        <span>Start: {task.assignedDate}</span>
                        <span className="text-gray-200 font-medium">Due: {task.dueDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#222226]/50 text-[10px]">
                      {col.key !== "todo" && (
                        <button onClick={() => moveTask(task.id, "todo")} className="text-gray-400 hover:text-white">← To Do</button>
                      )}
                      {col.key !== "in_progress" && (
                        <button onClick={() => moveTask(task.id, "in_progress")} className="text-gray-300 hover:text-white">Progress</button>
                      )}
                      {col.key !== "done" && (
                        <button onClick={() => moveTask(task.id, "done")} className="text-white font-medium hover:underline ml-auto">Done ✓</button>
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
