/**
 * Sika Creative OS - Mobile Push & Notification Helper
 * Mendukung notifikasi status bar / tray HP (Android & iOS PWA) dan desktop browser
 */

import { savePushSubscriptionAction } from "@/actions/actions";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid-keys";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("Failed to register service worker:", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(userId: string, userEmail?: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    if (sub) {
      const rawSub = JSON.parse(JSON.stringify(sub));
      await savePushSubscriptionAction(rawSub, userId, userEmail);
    }
    return sub;
  } catch (err) {
    console.warn("Could not subscribe to push notifications:", err);
    return null;
  }
}

export async function requestMobileNotificationPermission(
  userId?: string,
  userEmail?: string
): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // Register service worker terlebih dahulu
  await registerServiceWorker();

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" && userId) {
      // Daftarkan push subscription ke server agar HP tetap dapat notif saat apps ditutup
      await subscribeToPushNotifications(userId, userEmail);
    }
    return permission;
  } catch (err) {
    console.warn("Error requesting notification permission:", err);
    return Notification.permission;
  }
}

export interface MobileNotificationOptions {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  vibrate?: number[];
}

export async function triggerHapticFeedback(pattern: number[] = [300, 100, 300]) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export async function showMobileNotification(
  title: string,
  options: MobileNotificationOptions
) {
  // Selalu getarkan HP jika didukung oleh browser/perangkat
  triggerHapticFeedback(options.vibrate || [300, 100, 300]);

  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || "/icon-192.png",
    badge: options.badge || "/icon-192.png",
    tag: options.tag || `sika-${Date.now()}`,
    vibrate: options.vibrate || [300, 100, 300, 100, 300],
    renotify: false,
    requireInteraction: false,
    silent: false,
    data: {
      url: options.url || "/",
    },
  };

  // 1. Coba kirimkan via Service Worker (Standar resmi mobile Android/iOS HP)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notificationOptions as any);
        return;
      }
    } catch (swErr) {
      console.warn("ServiceWorker showNotification failed, falling back to Notification API:", swErr);
    }
  }

  // 2. Fallback ke standard Notification constructor jika Service Worker belum ready
  try {
    const notif = new Notification(title, {
      body: options.body,
      icon: notificationOptions.icon,
      tag: notificationOptions.tag,
    });
    if (options.url) {
      notif.onclick = () => {
        window.focus();
        window.location.href = options.url!;
      };
    }
  } catch (notifErr) {
    console.warn("Desktop notification error:", notifErr);
  }
}
