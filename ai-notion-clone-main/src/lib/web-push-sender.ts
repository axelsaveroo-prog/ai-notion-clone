import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { VAPID_PUBLIC_KEY } from "@/lib/vapid-keys";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "xorksXJZJ1Th4A_XUYfn7c1dwxJuh5pHs4-LLpartIM";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:notifications@sikacreative.com";

// Inisialisasi VAPID Details
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn("Failed to set VAPID details:", e);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

export async function savePushSubscription(data: {
  userId: string;
  userEmail?: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}) {
  try {
    const endpoint = data.subscription.endpoint;
    const keys = data.subscription.keys;
    const userId = data.userId;
    const userEmail = (data.userEmail || "").toLowerCase().trim();

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        userEmail: userEmail || null,
        endpoint,
        keys: keys as any,
      },
      update: {
        userId,
        userEmail: userEmail || null,
        keys: keys as any,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Gagal menyimpan push subscription:", error);
    return { success: false, error };
  }
}

export async function sendWebPushNotification(params: {
  userEmails?: string[];
  userIds?: string[];
  excludeUserId?: string;
  excludeEmail?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}) {
  try {
    const rawEmails = params.userEmails || [];
    const rawUserIds = params.userIds || [];

    const excludeId = params.excludeUserId || "";
    const excludeEmail = (params.excludeEmail || "").toLowerCase().trim();

    // 1. Ambil seluruh data user untuk resolusi fleksibel (ID, nama panggilan, email)
    const targetUserIds = new Set<string>();
    const targetEmails = new Set<string>();

    // Tambahkan input awal jika tampak sebagai ID atau email
    for (const id of rawUserIds) {
      if (id && id !== excludeId) targetUserIds.add(id);
    }
    for (const em of rawEmails) {
      const clean = em.toLowerCase().trim();
      if (clean && clean !== excludeEmail) {
        if (clean.includes("@")) {
          targetEmails.add(clean);
        }
      }
    }

    // Resolusi nama assignees atau display names (misal "Bintang Ebenheazer", "@Bintang", dsb.)
    try {
      const dbUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true },
      });

      const allInputs = [...rawEmails, ...rawUserIds];

      for (const rawInput of allInputs) {
        const clean = rawInput.toLowerCase().replace(/^@+/, "").trim();
        if (!clean || clean === "you" || clean === "all" || clean === "team") continue;

        for (const u of dbUsers) {
          const uName = (u.name || "").toLowerCase().trim();
          const uEmail = (u.email || "").toLowerCase().trim();
          const uId = u.id;

          const isMatch =
            uId === clean ||
            uEmail === clean ||
            uName === clean ||
            (clean.length > 2 && (uName.includes(clean) || clean.includes(uName)));

          if (isMatch) {
            if (uId && uId !== excludeId) targetUserIds.add(uId);
            if (uEmail && uEmail !== excludeEmail) targetEmails.add(uEmail);
          }
        }
      }
    } catch (e) {
      console.warn("Could not resolve users for web push:", e);
    }

    // Jika tidak ada target yang valid setelah resolusi
    if (targetUserIds.size === 0 && targetEmails.size === 0) {
      return { success: true, count: 0 };
    }

    // 2. Query subscriptions yang tersimpan di Supabase
    const orConditions: any[] = [];
    if (targetUserIds.size > 0) {
      orConditions.push({ userId: { in: Array.from(targetUserIds) } });
    }
    if (targetEmails.size > 0) {
      orConditions.push({ userEmail: { in: Array.from(targetEmails) } });
    }

    const subs = await prisma.pushSubscription.findMany({
      where: {
        OR: orConditions,
      },
    });

    if (!subs || subs.length === 0) {
      return { success: true, count: 0 };
    }

    const payloadString = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: "/touch icon sika-04.png",
      badge: "/touch icon sika-03.png",
      url: params.url || "/",
      tag: params.tag || `heads-up-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    });

    const sendPromises = subs.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: typeof sub.keys === "string" ? JSON.parse(sub.keys) : (sub.keys as any),
        };

        await webpush.sendNotification(pushSubscription, payloadString, {
          urgency: "high", // Memicu heads-up banner di Android
          TTL: 60 * 60 * 24, // 24 jam
        });
      } catch (err: any) {
        // Hapus subscription yang sudah tidak valid/expired di push service
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            await prisma.pushSubscription.delete({
              where: { endpoint: sub.endpoint },
            });
          } catch {}
        }
      }
    });

    await Promise.allSettled(sendPromises);
    return { success: true, count: subs.length };
  } catch (err) {
    console.error("Gagal mengirim web push notification:", err);
    return { success: false, error: err };
  }
}
