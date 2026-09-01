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

  const columns: { key: Task["status"]; label: string }[] = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  return (
    <div className="w-full bg-[#121214] border border-[#222226] p-5 sm:p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-sm sm:text-base tracking-wide text-white uppercase">
          📌 FOR YOU — Tasks
        </h3>
        <span className="text-xs bg-[#1a1a1e] text-gray-200 px-3 py-1 rounded-md border border-[#222226] font-medium">
          Assigned to You
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.key} className="bg-[#161618] p-4 rounded-xl border border-[#222226] flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 px-1">
              {col.label} ({tasks.filter(t => t.status === col.key).length})
            </h4>

            <div className="flex flex-col gap-3">
              {tasks.filter(t => t.status === col.key).map(task => (
                <div key={task.id} className="bg-[#121214] p-4 rounded-xl border border-[#222226] flex flex-col gap-3 shadow-sm">
                  <span className="text-[11px] bg-[#1a1a1e] text-gray-200 font-semibold px-2.5 py-1 rounded w-fit border border-[#27272a] tracking-wide">
                    {task.client}
                  </span>
                  <p className="text-sm sm:text-base text-gray-100 font-medium leading-relaxed">{task.title}</p>
                  
                  <div className="flex gap-3 pt-2.5 border-t border-[#222226] text-xs font-medium">
                    {col.key !== "todo" && (
                      <button onClick={() => moveTask(task.id, "todo")} className="text-gray-400 hover:text-white transition-colors">← To Do</button>
                    )}
                    {col.key !== "in_progress" && (
                      <button onClick={() => moveTask(task.id, "in_progress")} className="text-gray-300 hover:text-white ml-auto transition-colors">Progress</button>
                    )}
                    {col.key !== "done" && (
                      <button onClick={() => moveTask(task.id, "done")} className="text-white font-semibold hover:underline ml-auto">Done ✓</button>
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
