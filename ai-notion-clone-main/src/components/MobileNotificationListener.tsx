"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  registerServiceWorker,
  requestMobileNotificationPermission,
  showMobileNotification,
} from "@/lib/mobile-notifications";
import { getTasksAction, getCalendarEvents } from "@/actions/actions";
import { Bell, X, Check } from "lucide-react";

export function MobileNotificationListener() {
  const { user, isLoaded } = useUser();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const isCheckingRef = useRef(false);

  // Inisialisasi Service Worker & Cek Izin Notifikasi
  useEffect(() => {
    if (typeof window === "undefined") return;

    registerServiceWorker();

    if ("Notification" in window) {
      setPermission(Notification.permission);
      // Jika izin belum pernah diminta, dan user belum dismiss banner hari ini
      const isDismissed = localStorage.getItem("SIKA_NOTIF_PROMPT_DISMISSED");
      if (Notification.permission === "default" && !isDismissed) {
        setShowPrompt(true);
      }
    }
  }, []);

  // Handler user klik "Aktifkan Notifikasi HP"
  const handleEnableNotifications = async () => {
    const res = await requestMobileNotificationPermission();
    setPermission(res);
    setShowPrompt(false);
    if (res === "granted") {
      showMobileNotification("Sika Creative OS", {
        body: "Notifikasi HP berhasil diaktifkan! Kamu akan menerima notifikasi saat ada chat atau tag brief.",
        url: "/",
      });
    }
  };

  const handleDismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("SIKA_NOTIF_PROMPT_DISMISSED", "true");
  };

  // Polling deteksi tag brief / tasks dan jadwal kalender untuk user yang sedang login
  useEffect(() => {
    if (!isLoaded || !user) return;

    const userNames = [
      user.fullName,
      user.firstName,
      user.username,
      user.primaryEmailAddress?.emailAddress,
    ]
      .filter(Boolean)
      .map((s) => s!.toLowerCase().trim());

    const checkBriefAndScheduleTags = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;

      try {
        // Ambil ID yang sudah pernah dinotifikasikan dari localStorage
        const storedNotified = localStorage.getItem("SIKA_NOTIFIED_ITEMS");
        const notifiedSet = new Set<string>(
          storedNotified ? JSON.parse(storedNotified) : []
        );

        // 1. Cek Tag Brief / Task
        const tasks = await getTasksAction();
        if (tasks && Array.isArray(tasks)) {
          for (const task of tasks) {
            if (notifiedSet.has(`task-${task.id}`)) continue;

            const assigneeLower = (task.assignee || "").toLowerCase();
            const isUserAssigned = userNames.some(
              (name) => name && (assigneeLower.includes(name) || assigneeLower === "you")
            );

            // Jika ini task pertama kali di-load aplikasi saat pertama buka, simpan tanpa spam
            if (!storedNotified) {
              notifiedSet.add(`task-${task.id}`);
              continue;
            }

            if (isUserAssigned) {
              notifiedSet.add(`task-${task.id}`);
              showMobileNotification(`📌 Tagged in Brief: ${task.title}`, {
                body: `${task.assignedBy || "Tim"} menugaskan kamu di brief [${task.client}]`,
                tag: `task-${task.id}`,
                url: "/tasks",
              });
            }
          }
        }

        // 2. Cek Tag Jadwal Kalender
        const events: any = await getCalendarEvents();
        if (events && Array.isArray(events)) {
          for (const ev of events) {
            if (notifiedSet.has(`event-${ev.id}`)) continue;

            const assignees = Array.isArray(ev.assignees) ? ev.assignees : [];
            const isUserTagged = assignees.some((a: string) => {
              const aLower = (a || "").toLowerCase().trim();
              return userNames.some((uName) => uName && aLower.includes(uName));
            });

            if (!storedNotified) {
              notifiedSet.add(`event-${ev.id}`);
              continue;
            }

            if (isUserTagged) {
              notifiedSet.add(`event-${ev.id}`);
              showMobileNotification(`🗓️ New Schedule: ${ev.title}`, {
                body: `${ev.creatorName || "Tim"} menandai kamu di jadwal ${ev.client} (${ev.date})`,
                tag: `event-${ev.id}`,
                url: "/calendar",
              });
            }
          }
        }

        // Simpan set ID terbaru (batasi maksimal 200 id terakhir)
        const updatedArray = Array.from(notifiedSet).slice(-200);
        localStorage.setItem("SIKA_NOTIFIED_ITEMS", JSON.stringify(updatedArray));
      } catch (err) {
        console.warn("Could not check brief tags:", err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Jalankan segera dan ulangi tiap 20 detik
    checkBriefAndScheduleTags();
    const interval = setInterval(checkBriefAndScheduleTags, 20000);
    return () => clearInterval(interval);
  }, [user, isLoaded]);

  // Floating Banner Permintaan Izin Notifikasi HP (hanya jika permission === 'default')
  if (!showPrompt || permission === "granted") return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40 bg-[#16171d]/95 backdrop-blur-md border border-[#C65921]/40 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-[#C65921]/15 text-[#C65921] flex items-center justify-center shrink-0 border border-[#C65921]/30">
          <Bell size={16} />
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-white truncate">Aktifkan Notifikasi HP</h4>
          <p className="text-[11px] text-zinc-400 line-clamp-1">
            Dapatkan notif chat & tag brief langsung di HP
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleEnableNotifications}
          className="px-3 py-1.5 bg-[#C65921] hover:bg-[#d86629] text-white font-medium text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
        >
          <Check size={12} />
          <span>Izinkan</span>
        </button>
        <button
          onClick={handleDismissPrompt}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
          title="Tutup"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

