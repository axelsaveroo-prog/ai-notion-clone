"use client";

import { useState } from "react";

interface Task {
  id: string;
  title: string;
  client: string;
  status: "todo" | "in_progress" | "done";
}

export function ForYouKanban() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Review brand guidelines", client: "AKASA LAND", status: "todo" },
    { id: "2", title: "Update contract details", client: "APERIO", status: "in_progress" },
    { id: "3", title: "Finalize logo assets", client: "BALI FINE GALLERY", status: "done" },
  ]);

  const moveTask = (id: string, newStatus: Task["status"]) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
  };

  const columns: { key: Task["status"]; label: string; bg: string }[] = [
    { key: "todo", label: "To Do", bg: "border-gray-800" },
    { key: "in_progress", label: "In Progress", bg: "border-orange-500/30" },
    { key: "done", label: "Done", bg: "border-green-500/30" },
  ];

  return (
    <div className="w-full bg-[#161618] border border-[#27272a] p-5 rounded-2xl shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          <span>📌</span> FOR YOU — Tasks
        </h3>
        <span className="text-xs bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full border border-orange-500/20 font-medium">
          Assigned to You
        </span>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.key} className={`bg-[#121214] p-3 rounded-xl border ${col.bg} flex flex-col gap-3`}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
              {col.label} ({tasks.filter(t => t.status === col.key).length})
            </h4>

            <div className="flex flex-col gap-2">
              {tasks.filter(t => t.status === col.key).map(task => (
                <div key={task.id} className="bg-[#1a1a1e] p-3 rounded-lg border border-[#27272a] shadow-sm flex flex-col gap-2">
                  <span className="text-[10px] bg-orange-500/15 text-orange-400 font-semibold px-2 py-0.5 rounded w-fit">
                    {task.client}
                  </span>
                  <p className="text-xs font-medium text-gray-200">{task.title}</p>
                  
                  {/* Quick Status Shift Actions */}
                  <div className="flex gap-1 pt-1 border-t border-[#27272a]/50 text-[10px]">
                    {col.key !== "todo" && (
                      <button onClick={() => moveTask(task.id, "todo")} className="text-gray-400 hover:text-white">← To Do</button>
                    )}
                    {col.key !== "in_progress" && (
                      <button onClick={() => moveTask(task.id, "in_progress")} className="text-orange-400 hover:text-orange-300 ml-auto">Progress</button>
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
