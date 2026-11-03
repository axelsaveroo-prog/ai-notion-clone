/**
 * Sika Creative OS - Mobile Push & Notification Helper
 * Mendukung notifikasi status bar / tray HP (Android & iOS PWA) dan desktop browser
 */

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

export async function requestMobileNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // Register service worker terlebih dahulu
  await registerServiceWorker();

  try {
    const permission = await Notification.requestPermission();
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

export async function showMobileNotification(
  title: string,
  options: MobileNotificationOptions
) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || "/touch icon sika-04.png",
    badge: options.badge || "/touch icon sika-03.png",
    tag: options.tag || "sika-notification",
    vibrate: options.vibrate || [250, 100, 250],
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

