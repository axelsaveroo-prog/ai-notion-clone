"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  registerServiceWorker,
  requestMobileNotificationPermission,
  showMobileNotification,
  triggerHapticFeedback,
} from "@/lib/mobile-notifications";
import { getTasksAction, getCalendarEvents } from "@/actions/actions";
import { Bell, X, Check, FileText, Calendar, Smartphone } from "lucide-react";

export function MobileNotificationListener() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const isCheckingRef = useRef(false);

  // In-App Notification Toast (ala WhatsApp / Notion di bagian ATAS layar)
  const [inAppToast, setInAppToast] = useState<{
    id: string;
    title: string;
    body: string;
    type: "brief" | "schedule";
    url: string;
    time: string;
  } | null>(null);

  // Deteksi perangkat & inisialisasi Service Worker
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

  // Handler aktifkan notifikasi
  const handleEnableNotifications = async () => {
    triggerHapticFeedback([100, 50, 100]);
    const res = await requestMobileNotificationPermission();
    setPermission(res);
    setShowPrompt(false);
    if (res === "granted") {
      showMobileNotification("Sika Creative OS", {
        body: isMobileDevice
          ? "Notifikasi HP aktif! Kamu akan menerima getar & notif saat ada pesan atau tag brief."
          : "Notifikasi browser aktif! Pesan & tag brief akan muncul secara realtime.",
        url: "/",
        vibrate: [200, 100, 200],
      });
    }
  };

  const handleDismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("SIKA_NOTIF_PROMPT_DISMISSED", "true");
  };

  // Auto dismiss In-App Toast setelah 6 detik
  useEffect(() => {
    if (!inAppToast) return;
    const timer = setTimeout(() => {
      setInAppToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [inAppToast]);

  // Polling deteksi tag brief / tasks dan jadwal kalender untuk user yang login
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

        // 1. Cek Tag Brief / Task
        const tasks = await getTasksAction();
        if (tasks && Array.isArray(tasks)) {
          for (const task of tasks) {
            if (notifiedSet.has(`task-${task.id}`)) continue;

            const assigneeLower = (task.assignee || "").toLowerCase();
            const isUserAssigned = userNames.some(
              (name) => name && (assigneeLower.includes(name) || assigneeLower === "you")
            );

            // Task pertama kali di-load tidak dispam
            if (!storedNotified) {
              notifiedSet.add(`task-${task.id}`);
              continue;
            }

            if (isUserAssigned) {
              notifiedSet.add(`task-${task.id}`);

              // Getar HP
              triggerHapticFeedback([300, 150, 300]);

              // Notifikasi System Tray / HP
              showMobileNotification(`📌 Tagged in Brief: ${task.title}`, {
                body: `${task.assignedBy || "Tim"} menugaskan kamu di brief [${task.client}]`,
                tag: `task-${task.id}`,
                url: "/tasks",
                vibrate: [300, 150, 300],
              });

              // Kotak Pop-up in-app ala WhatsApp / Notion di atas layar
              setInAppToast({
                id: `task-${task.id}`,
                title: task.title,
                body: `${task.assignedBy || "Tim"} menandai kamu di brief [${task.client}]`,
                type: "brief",
                url: "/tasks",
                time: "Baru saja",
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

              // Getar HP
              triggerHapticFeedback([300, 150, 300]);

              // Notifikasi System Tray / HP
              showMobileNotification(`🗓️ New Schedule: ${ev.title}`, {
                body: `${ev.creatorName || "Tim"} menandai kamu di jadwal ${ev.client} (${ev.date})`,
                tag: `event-${ev.id}`,
                url: "/calendar",
                vibrate: [300, 150, 300],
              });

              // Kotak Pop-up in-app ala WhatsApp / Notion di atas layar
              setInAppToast({
                id: `event-${ev.id}`,
                title: ev.title,
                body: `${ev.creatorName || "Tim"} menandai kamu untuk jadwal ${ev.client} (${ev.date})`,
                type: "schedule",
                url: "/calendar",
                time: "Baru saja",
              });
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

  return (
    <>
      {/* 1. KOTAK POPUP NOTIFIKASI IN-APP (ALA WHATSAPP / NOTION DI ATAS LAYAR) */}
      {inAppToast && (
        <div className="fixed top-3 left-3 right-3 sm:top-4 sm:right-5 sm:left-auto sm:max-w-sm z-[70] animate-in slide-in-from-top-4 fade-in duration-300">
          <div
            onClick={() => {
              const dest = inAppToast.url;
              setInAppToast(null);
              router.push(dest);
            }}
            className="bg-[#16171d]/95 backdrop-blur-md border border-zinc-800 text-white p-3 rounded-2xl shadow-2xl flex items-start gap-3 cursor-pointer transition hover:border-[#C65921]/60"
          >
            <div className="w-10 h-10 rounded-xl bg-[#202129] border border-zinc-700/60 text-[#C65921] flex items-center justify-center shrink-0 mt-0.5">
              {inAppToast.type === "brief" ? <FileText size={18} /> : <Calendar size={18} />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[#e58a5c] uppercase tracking-wide">
                  {inAppToast.type === "brief" ? "Brief Tag" : "Schedule Tag"}
                </span>
                <span className="text-[10px] text-zinc-500">{inAppToast.time}</span>
              </div>
              <h5 className="text-xs font-bold text-white truncate mt-0.5">
                {inAppToast.title}
              </h5>
              <p className="text-xs text-zinc-300 line-clamp-2 mt-0.5 leading-snug">
                {inAppToast.body}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInAppToast(null);
              }}
              className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer shrink-0 -mr-1 -mt-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2. BANNER PERMINTAAN IZIN NOTIFIKASI (DI ATAS LAYAR, TIDAK MENABRAK NAVBAR) */}
      {showPrompt && permission === "default" && (
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
                  ? "Aktifkan getar & notif untuk chat dan tag brief"
                  : "Aktifkan notifikasi pesan dan tag brief secara realtime"}
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
      )}
    </>
  );
}
