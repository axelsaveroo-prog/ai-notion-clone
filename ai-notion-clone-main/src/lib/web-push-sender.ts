import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { ensureDatabaseTables } from "@/lib/ensure-db";
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
    await ensureDatabaseTables();
    const endpoint = data.subscription.endpoint;
    const keysJson = JSON.stringify(data.subscription.keys);
    const userId = data.userId;
    const userEmail = (data.userEmail || "").toLowerCase().trim();
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "PushSubscription" ("id", "userId", "userEmail", "endpoint", "keys", "createdAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT ("endpoint") DO UPDATE SET
         "userId" = EXCLUDED."userId",
         "userEmail" = EXCLUDED."userEmail",
         "keys" = EXCLUDED."keys";`,
      id,
      userId,
      userEmail,
      endpoint,
      keysJson
    );

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
    await ensureDatabaseTables();

    const normalizedEmails = (params.userEmails || [])
      .map((e) => e.toLowerCase().trim())
      .filter((e) => Boolean(e) && e !== (params.excludeEmail || "").toLowerCase().trim());

    const targetUserIds = (params.userIds || [])
      .filter((id) => Boolean(id) && id !== params.excludeUserId);

    if (normalizedEmails.length === 0 && targetUserIds.length === 0) {
      return { success: true, count: 0 };
    }

    // Ambil subscriptions dari database yang cocok
    const subs = await prisma.$queryRawUnsafe<
      { id: string; endpoint: string; keys: any; userId: string; userEmail: string }[]
    >(
      `SELECT "id", "endpoint", "keys", "userId", "userEmail"
       FROM "PushSubscription"
       WHERE "userEmail" = ANY($1::text[]) OR "userId" = ANY($2::text[]);`,
      normalizedEmails,
      targetUserIds
    );

    if (!subs || subs.length === 0) {
      return { success: true, count: 0 };
    }

    const payloadString = JSON.stringify({
      title: params.title,
      body: params.body,
      icon: "/touch icon sika-04.png",
      badge: "/touch icon sika-03.png",
      url: params.url || "/",
      tag: params.tag || `heads-up-${Date.now()}`,
    });

    const sendPromises = subs.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: typeof sub.keys === "string" ? JSON.parse(sub.keys) : sub.keys,
        };

        await webpush.sendNotification(pushSubscription, payloadString, {
          urgency: "high", // Memicu heads-up popup di HP Android
          TTL: 60 * 60 * 24, // 24 jam
        });
      } catch (err: any) {
        // Jika subscription sudah tidak aktif (status 404 / 410 Gone), bersihkan dari DB
        if (err.statusCode === 404 || err.statusCode === 410) {
          try {
            await prisma.$executeRawUnsafe(
              `DELETE FROM "PushSubscription" WHERE "endpoint" = $1;`,
              sub.endpoint
            );
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
