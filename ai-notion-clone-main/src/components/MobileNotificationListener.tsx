"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  registerServiceWorker,
  requestMobileNotificationPermission,
  subscribeToPushNotifications,
  showMobileNotification,
  triggerHapticFeedback,
} from "@/lib/mobile-notifications";
import { getTasksAction, getCalendarEvents } from "@/actions/actions";
import { Bell, X, Check, Smartphone } from "lucide-react";

export function MobileNotificationListener() {
  const { user, isLoaded } = useUser();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const isCheckingRef = useRef(false);
  const isInitialRunRef = useRef(true);

  // Inisialisasi Service Worker & Cek Izin Notifikasi
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsMobileDevice(window.innerWidth < 640 || "ontouchstart" in window);
    registerServiceWorker();

    if ("Notification" in window) {
      setPermission(Notification.permission);
      const isDismissed = localStorage.getItem("SIKA_NOTIF_PROMPT_DISMISSED");
      if (Notification.permission === "default" && !isDismissed) {
        setShowPrompt(true);
      }
    }
  }, []);

  // Daftarkan Web Push Subscription saat user login & izin granted
  // Ini kunci agar notifikasi tetap POP UP di HP meskipun aplikasi/browser ditutup (close apps)
  useEffect(() => {
    if (!isLoaded || !user) return;

    if (typeof window !== "undefined" && "Notification" in window) {
      const currentPerm = Notification.permission;
      setPermission(currentPerm);
      if (currentPerm === "granted") {
        subscribeToPushNotifications(
          user.id,
          user.primaryEmailAddress?.emailAddress
        );
      }
    }
  }, [isLoaded, user]);

  // Handler saat user mengizinkan notifikasi
  const handleEnableNotifications = async () => {
    const res = await requestMobileNotificationPermission(
      user?.id,
      user?.primaryEmailAddress?.emailAddress
    );
    setPermission(res);
    setShowPrompt(false);
    if (res === "granted" && user) {
      await subscribeToPushNotifications(
        user.id,
        user.primaryEmailAddress?.emailAddress
      );
    }
  };

  const handleDismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("SIKA_NOTIF_PROMPT_DISMISSED", "true");
  };

  // Polling deteksi tag brief & jadwal kalender saat aplikasi sedang dibuka
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
        const storedNotified = localStorage.getItem("SIKA_NOTIFIED_ITEMS");
        const notifiedSet = new Set<string>(
          storedNotified ? JSON.parse(storedNotified) : []
        );

        const tasks = await getTasksAction();
        const events: any = await getCalendarEvents();

        // PENTING: Saat pertama kali dibuka / dimuat, indeks semua task & event yang ada tanpa getar & tanpa notif
        // Ini memastikan HP TIDAK AKAN PERNAH GETAR hanya karena aplikasi baru dibuka!
        if (isInitialRunRef.current) {
          if (tasks && Array.isArray(tasks)) {
            for (const task of tasks) {
              notifiedSet.add(`task-${task.id}`);
            }
          }
          if (events && Array.isArray(events)) {
            for (const ev of events) {
              notifiedSet.add(`event-${ev.id}`);
            }
          }
          const updatedArray = Array.from(notifiedSet).slice(-200);
          localStorage.setItem("SIKA_NOTIFIED_ITEMS", JSON.stringify(updatedArray));
          isInitialRunRef.current = false;
          return;
        }

        // 1. Cek Tag Brief / Task BARU yang masuk setelah aplikasi dibuka
        if (tasks && Array.isArray(tasks)) {
          for (const task of tasks) {
            if (notifiedSet.has(`task-${task.id}`)) continue;

            const assigneeLower = (task.assignee || "").toLowerCase();
            const isUserAssigned = userNames.some(
              (name) => name && (assigneeLower.includes(name) || assigneeLower === "you")
            );

            if (isUserAssigned) {
              notifiedSet.add(`task-${task.id}`);

              // Getar HP dan tampilkan notifikasi sistem/tray HP untuk task baru
              triggerHapticFeedback([300, 150, 300]);
              showMobileNotification(`📌 Tagged in Brief: ${task.title}`, {
                body: `${task.assignedBy || "Tim"} menugaskan kamu di brief [${task.client}]`,
                tag: `task-${task.id}`,
                url: "/tasks",
                vibrate: [300, 150, 300],
              });
            } else {
              notifiedSet.add(`task-${task.id}`);
            }
          }
        }

        // 2. Cek Tag Jadwal Kalender BARU yang masuk setelah aplikasi dibuka
        if (events && Array.isArray(events)) {
          for (const ev of events) {
            if (notifiedSet.has(`event-${ev.id}`)) continue;

            const assignees = Array.isArray(ev.assignees) ? ev.assignees : [];
            const isUserTagged = assignees.some((a: string) => {
              const aLower = (a || "").toLowerCase().trim();
              return userNames.some((uName) => uName && aLower.includes(uName));
            });

            if (isUserTagged) {
              notifiedSet.add(`event-${ev.id}`);

              // Getar HP dan tampilkan notifikasi sistem/tray HP untuk event baru
              triggerHapticFeedback([300, 150, 300]);
              showMobileNotification(`🗓️ New Schedule: ${ev.title}`, {
                body: `${ev.creatorName || "Tim"} menandai kamu di jadwal ${ev.client} (${ev.date})`,
                tag: `event-${ev.id}`,
                url: "/calendar",
                vibrate: [300, 150, 300],
              });
            } else {
              notifiedSet.add(`event-${ev.id}`);
            }
          }
        }

        const updatedArray = Array.from(notifiedSet).slice(-200);
        localStorage.setItem("SIKA_NOTIFIED_ITEMS", JSON.stringify(updatedArray));
      } catch (err) {
        console.warn("Could not check brief tags:", err);
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkBriefAndScheduleTags();
    const interval = setInterval(checkBriefAndScheduleTags, 20000);
    return () => clearInterval(interval);
  }, [user, isLoaded]);

  // Hanya tampilkan banner izin jika status masih 'default'
  if (!showPrompt || permission === "granted") return null;

  return (
    <div className="fixed top-3 left-3 right-3 sm:top-4 sm:right-5 sm:left-auto sm:max-w-sm z-[65] bg-[#14151a]/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-3 duration-300">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-[#C65921] flex items-center justify-center shrink-0">
          {isMobileDevice ? <Smartphone size={16} /> : <Bell size={16} />}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-white truncate">
            {isMobileDevice ? "Notifikasi HP" : "Notifikasi Browser"}
          </h4>
          <p className="text-[11px] text-zinc-400 line-clamp-1">
            {isMobileDevice
              ? "Aktifkan pop-up saat ada chat & tag brief di HP"
              : "Aktifkan notifikasi browser saat ada chat & brief"}
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
          className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition cursor-pointer"
          title="Tutup"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
