// @ts-nocheck
"use server";

import { auth, currentUser, createClerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ==========================================
// 1. USER ACTIONS (CLERK & SUPABASE SYNC)
// ==========================================

export async function syncUserAction() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return null;

    const email = user.emailAddresses[0]?.emailAddress || "";
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || email;
    const imageUrl = user.imageUrl || "";

    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: { name, email, imageUrl },
      create: {
        id: userId,
        email,
        name,
        imageUrl,
      },
    });

    return dbUser;
  } catch (error) {
    console.error("Gagal sync user:", error);
    return null;
  }
}

export async function getUsersAction() {
  try {
    // Ambil daftar seluruh user terdaftar langsung dari Clerk SDK
    const response = await clerkClient.users.getUserList();
    
    return response.data.map((u) => {
      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      const displayName = fullName || u.username || u.emailAddresses[0]?.emailAddress || "Member";
      return {
        id: u.id,
        name: displayName,
        email: u.emailAddresses[0]?.emailAddress || "",
      };
    });
  } catch (error) {
    console.error("Gagal mengambil data users dari Clerk:", error);
    // Fallback ambil dari database jika Clerk SDK gagal
    try {
      return await prisma.user.findMany({
        orderBy: { name: "asc" },
      });
    } catch (dbErr) {
      return [];
    }
  }
}

// ==========================================
// 2. DOCUMENT ACTIONS (NOTION CLONE)
// ==========================================

export async function deleteDocumentAction(docId: string) {
  try {
    await prisma.document.delete({ where: { id: docId } });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus dokumen:", error);
    return { success: false };
  }
}

export async function updateDocumentTitleAction(docId: string, title: string) {
  try {
    await prisma.document.update({
      where: { id: docId },
      data: { title },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal memperbarui judul dokumen:", error);
    return { success: false };
  }
}

export async function inviteUserToDocumentAction(docId: string, email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, message: "User tidak ditemukan" };

    await prisma.usersToDocument.create({
      data: {
        documentId: docId,
        userId: user.id,
      },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal mengundang user:", error);
    return { success: false };
  }
}

export async function removeUserFromDocumentAction(docId: string, userId: string) {
  try {
    await prisma.usersToDocument.deleteMany({
      where: {
        documentId: docId,
        userId: userId,
      },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus user dari dokumen:", error);
    return { success: false };
  }
}

export async function fetchUsersFromDocument(docId: string) {
  try {
    const usersInDoc = await prisma.usersToDocument.findMany({
      where: { documentId: docId },
      include: { user: true },
    });
    return usersInDoc.map((item) => item.user);
  } catch (error) {
    console.error("Gagal mengambil user dokumen:", error);
    return [];
  }
}

// ==========================================
// 3. CALENDAR & SCHEDULE ACTIONS
// ==========================================

export async function getCalendarEvents() {
  try {
    return await prisma.scheduleEvent.findMany({
      orderBy: { date: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil event kalender:", error);
    return [];
  }
}

export async function createCalendarEvent(data: {
  title: string;
  client: string;
  date: string;
  time: string;
  assignees: string[];
}) {
  const newEvent = await prisma.scheduleEvent.create({ data });
  revalidatePath("/calendar");
  revalidatePath("/");
  return newEvent;
}

export async function updateCalendarEvent(
  id: string,
  data: {
    title: string;
    client: string;
    date: string;
    time: string;
    assignees: string[];
  }
) {
  const updated = await prisma.scheduleEvent.update({
    where: { id },
    data,
  });
  revalidatePath("/calendar");
  revalidatePath("/");
  return updated;
}

export async function deleteCalendarEvent(id: string) {
  await prisma.scheduleEvent.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath("/");
}

// ==========================================
// 4. CHATBOX ACTIONS
// ==========================================

export async function getChatMessages(channelId: string) {
  try {
    return await prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil pesan chat:", error);
    return [];
  }
}

export async function sendChatMessage(data: {
  channelId: string;
  sender: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
}) {
  const newMsg = await prisma.chatMessage.create({ data });
  return newMsg;
}

// ==========================================
// 5. ATTENDANCE / PRESENSI ACTIONS
// ==========================================

export async function submitAttendanceAction(data: {
  userId: string;
  userName: string;
  userEmail: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  imageUrl?: string;
  location?: string;
  note?: string;
}) {
  try {
    const record = await prisma.attendance.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        type: data.type,
        imageUrl: data.imageUrl,
        location: data.location || "Office",
        note: data.note || "",
      },
    });
    revalidatePath("/admin/attendance");
    revalidatePath("/");
    return { success: true, record };
  } catch (error) {
    console.error("Gagal menyimpan presensi:", error);
    return { success: false, error: "Gagal menyimpan presensi" };
  }
}

export async function getAllAttendancesAction() {
  try {
    return await prisma.attendance.findMany({
      orderBy: { timestamp: "desc" },
    });
  } catch (error) {
    console.error("Gagal mengambil data presensi:", error);
    return [];
  }
}

export async function getTodayAttendanceStatusAction(userId: string) {
  try {
    // Ambil rentang awal dan akhir hari ini secara lokal
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Cari presensi user yang tercatat KHUSUS HARI INI
    const todayRecords = await prisma.attendance.findMany({
      where: {
        userId: userId,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const hasClockedIn = todayRecords.some((r) => r.type === "CLOCK_IN");
    const hasClockedOut = todayRecords.some((r) => r.type === "CLOCK_OUT");

    return {
      hasClockedIn,
      hasClockedOut,
      todayRecords,
    };
  } catch (error) {
    console.error("Gagal mengecek status presensi hari ini:", error);
    return { hasClockedIn: false, hasClockedOut: false, todayRecords: [] };
  }
}

// ==========================================
// CALENDAR ACTIONS
// ==========================================

export async function createCalendarEventAction(data: {
  title: string;
  description?: string;
  startDate: Date | string;
  endDate?: Date | string;
  userId: string;
  userName?: string;
}) {
  try {
    const newEvent = await prisma.calendarEvent.create({
      data: {
        title: data.title,
        description: data.description || "",
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : new Date(data.startDate),
        userId: data.userId,
        userName: data.userName || "",
      },
    });

    revalidatePath("/calendar");
    revalidatePath("/");

    return { success: true, event: newEvent };
  } catch (error) {
    console.error("Gagal menyimpan event kalender:", error);
    return { success: false, error: "Gagal menyimpan jadwal ke database." };
  }
}

export async function getCalendarEventsAction() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: { startDate: "asc" },
    });
    return events;
  } catch (error) {
    console.error("Gagal mengambil daftar event kalender:", error);
    return [];
  }
}

export async function deleteCalendarEventAction(eventId: string) {
  try {
    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    revalidatePath("/calendar");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus event kalender:", error);
    return { success: false, error: "Gagal menghapus jadwal." };
  }
}