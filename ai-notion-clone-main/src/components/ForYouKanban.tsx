"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { getTasksAction, updateTaskStatusAction } from "@/actions/actions";
import { ArrowRight, CheckCircle2, Clock, CheckSquare, Check } from "lucide-react";

interface Task {
  id: string;
  title: string;
  client: string;
  status: string;
  assignee?: string | null;
  assignedBy?: string | null;
  dueDate?: string | null;
}

export function ForYouKanban() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasksAction();
      if (data && Array.isArray(data)) {
        setTasks(data);
      }
    } catch (e) {
      console.error("Gagal memuat task:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const moveTask = async (id: string, newStatus: "todo" | "in_progress" | "done") => {
    // Optimistic UI update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    try {
      await updateTaskStatusAction(id, newStatus);
    } catch (e) {
      console.error("Gagal update status task:", e);
      loadTasks();
    }
  };

  const columns: { key: "todo" | "in_progress" | "done"; label: string }[] = [
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  // Filter tugas untuk user saat ini atau jika belum login/assignee general
  const currentIdentifiers = [
    user?.fullName?.toLowerCase(),
    user?.firstName?.toLowerCase(),
    user?.username?.toLowerCase(),
    user?.primaryEmailAddress?.emailAddress?.toLowerCase(),
    "you",
    "all",
    "team",
  ].filter(Boolean) as string[];

  const myTasks = tasks.filter((task) => {
    if (!task.assignee) return true;
    const a = task.assignee.toLowerCase().trim();
    return currentIdentifiers.some((idStr) => a === idStr || a.includes(idStr) || idStr.includes(a));
  });

  return (
    <div className="w-full bg-[#121214] border border-[#222226] p-5 sm:p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-sm sm:text-base tracking-wide text-white uppercase flex items-center gap-2">
          <CheckSquare size={16} className="text-zinc-400" /> FOR YOU — Tasks
        </h3>
        <Link
          href="/tasks"
          className="text-xs bg-[#1a1a1e] text-gray-300 hover:text-white px-3 py-1 rounded-md border border-[#222226] font-medium transition flex items-center gap-1"
        >
          <span>All Tasks</span>
          <ArrowRight className="w-3 h-3 opacity-60" />
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-zinc-500">Loading tasks in realtime...</div>
      ) : myTasks.length === 0 ? (
        <div className="bg-[#161618]/50 border border-dashed border-[#222226] p-6 rounded-xl text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
          <Clock className="w-5 h-5 text-zinc-600" />
          <span>No tasks or briefs assigned to you. Create a new task in Task Operations.</span>
          <Link
            href="/tasks"
            className="mt-1 text-xs text-white font-medium hover:underline flex items-center gap-1"
          >
            <span>Open Task Operations</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => {
            const colTasks = myTasks.filter((t) => t.status === col.key);

            return (
              <div
                key={col.key}
                className="bg-[#161618] p-4 rounded-xl border border-[#222226] flex flex-col gap-3 min-h-[160px]"
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300 px-1">
                  {col.label} ({colTasks.length})
                </h4>

                <div className="flex flex-col gap-3">
                  {colTasks.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-zinc-600 italic">
                      Empty
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-[#121214] p-4 rounded-xl border border-[#222226] flex flex-col gap-3 shadow-sm hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] bg-[#1a1a1e] text-gray-200 font-semibold px-2.5 py-1 rounded w-fit border border-[#27272a] tracking-wide">
                            {task.client}
                          </span>
                          {task.dueDate && (
                            <span className="text-[10px] text-zinc-500 font-medium">
                              Due: {task.dueDate}
                            </span>
                          )}
                        </div>

                        <Link href={`/tasks/${task.id}`} className="hover:underline cursor-pointer">
                          <p className="text-sm sm:text-base text-gray-100 font-medium leading-relaxed">
                            {task.title}
                          </p>
                        </Link>

                        <div className="flex gap-3 pt-2.5 border-t border-[#222226] text-xs font-medium">
                          {col.key !== "todo" && (
                            <button
                              onClick={() => moveTask(task.id, "todo")}
                              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                              ← To Do
                            </button>
                          )}
                          {col.key !== "in_progress" && (
                            <button
                              onClick={() => moveTask(task.id, "in_progress")}
                              className="text-gray-300 hover:text-white ml-auto transition-colors cursor-pointer"
                            >
                              Progress
                            </button>
                          )}
                          {col.key !== "done" && (
                            <button
                              onClick={() => moveTask(task.id, "done")}
                              className="text-white font-semibold hover:underline ml-auto cursor-pointer flex items-center gap-1"
                            >
                              <span>Done</span>
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
