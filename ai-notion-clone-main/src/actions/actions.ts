// @ts-nocheck
"use server";

import { auth, currentUser, createClerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureDatabaseTables } from "@/lib/ensure-db";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ==========================================
// 1. USER ACTIONS (CLERK & SUPABASE SYNC)
// ==========================================

export async function syncUserAction() {
  try {
    await ensureDatabaseTables();
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return null;

    const email = user.emailAddresses[0]?.emailAddress || "";
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || email;
    const imageUrl = user.imageUrl || "";

    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: { name, email, imageUrl, lastActiveAt: new Date() },
      create: {
        id: userId,
        email,
        name,
        imageUrl,
        lastActiveAt: new Date(),
      },
    });

    return dbUser;
  } catch (error) {
    console.error("Gagal sync user:", error);
    return null;
  }
}

export async function heartbeatAction() {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

let lastClerkSyncTime = 0;
const CLERK_SYNC_INTERVAL = 60 * 1000; // Sinkronisasi Clerk maksimal 1 menit sekali

export async function getUsersAction() {
  try {
    // 1. Ambil dari database Supabase / Postgres terlebih dahulu (super cepat ~30-50ms)
    const dbUsers = await prisma.user.findMany({
      orderBy: { name: "asc" },
    });

    const userMap = new Map<string, { id: string; name: string; email: string; imageUrl?: string; lastActiveAt?: string | null }>();
    dbUsers.forEach((u) => {
      if (u.id) {
        userMap.set(u.id, {
          id: u.id,
          name: u.name || u.email || "Member",
          email: u.email || "",
          imageUrl: u.imageUrl || "",
          lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
        });
      }
    });

    // 2. Sinkronkan ke Clerk API secara non-blocking di background (tidak menahan response user)
    const now = Date.now();
    if (process.env.CLERK_SECRET_KEY && (dbUsers.length === 0 || now - lastClerkSyncTime > CLERK_SYNC_INTERVAL)) {
      lastClerkSyncTime = now;
      fetch("https://api.clerk.com/v1/users?limit=100", {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((clerkData) => {
          if (Array.isArray(clerkData)) {
            for (const u of clerkData) {
              const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
              const displayName = fullName || u.username || u.email_addresses?.[0]?.email_address || "Member";
              const email = u.email_addresses?.[0]?.email_address || "";
              const imageUrl = u.image_url || "";

              prisma.user.upsert({
                where: { id: u.id },
                update: { name: displayName, email, imageUrl },
                create: { id: u.id, name: displayName, email, imageUrl, lastActiveAt: new Date() },
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          console.warn("Background Clerk sync warning:", err);
        });
    }

    return Array.from(userMap.values());
  } catch (error) {
    console.error("Gagal mengambil data users:", error);
    return [];
  }
}

// ==========================================
// 2. DOCUMENT ACTIONS (NOTION CLONE)
// ==========================================

export async function createNewDocumentAction() {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const doc = await prisma.document.create({
      data: {
        title: "Untitled Document",
        usersToDocuments: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });

    revalidatePath("/");
    return doc.id;
  } catch (error) {
    console.error("Gagal membuat dokumen baru:", error);
    return null;
  }
}

export async function fetchDocumentsFromUser(userId: string) {
  try {
    const userDocs = await prisma.usersToDocument.findMany({
      where: { userId },
      include: { document: true },
    });
    return userDocs.map((item) => item.document);
  } catch (error) {
    console.error("Gagal mengambil dokumen user:", error);
    return [];
  }
}

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
// 3. CHATBOX ACTIONS (REAL GROUPS & DIRECT MESSAGES)
// ==========================================

export async function getChatChannelsAction(currentUserId?: string) {
  try {
    await ensureDatabaseTables();
    let channels = await prisma.chatChannel.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Jika belum ada channel sama sekali, seed channel #general sebagai default
    if (channels.length === 0) {
      const defaultGeneral = await prisma.chatChannel.create({
        data: {
          id: "general",
          name: "general",
          type: "group",
          description: "Saluran utama tim Sika Creative",
          members: [],
        },
      });
      channels = [defaultGeneral];
    }

    return channels;
  } catch (error) {
    console.error("Gagal mengambil saluran chat:", error);
    return [];
  }
}

export async function createChatGroupAction(data: {
  name: string;
  description?: string;
  members: string[];
  createdById?: string;
}) {
  try {
    const formattedName = data.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!formattedName) return { success: false, error: "Nama grup tidak boleh kosong" };

    const newChannel = await prisma.chatChannel.create({
      data: {
        id: "group_" + crypto.randomUUID(),
        name: formattedName,
        type: "group",
        description: data.description || "",
        members: data.members || [],
        createdById: data.createdById || null,
      },
    });

    return { success: true, channel: newChannel };
  } catch (error: any) {
    console.error("Gagal membuat grup chat:", error);
    return { success: false, error: error?.message || "Gagal membuat grup chat" };
  }
}

export async function getOrCreateDirectChannelAction(
  user1Id: string,
  user1Name: string,
  user2Id: string,
  user2Name: string
) {
  try {
    const sortedIds = [user1Id, user2Id].sort();
    const channelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

    let channel = await prisma.chatChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      channel = await prisma.chatChannel.create({
        data: {
          id: channelId,
          name: `${user1Name} & ${user2Name}`,
          type: "direct",
          members: [user1Id, user2Id],
        },
      });
    }

    return { success: true, channel };
  } catch (error: any) {
    console.error("Gagal membuat/mengambil DM channel:", error);
    return { success: false, error: error?.message };
  }
}

export async function deleteChatChannelAction(channelId: string) {
  try {
    if (channelId === "general") {
      return { success: false, error: "Channel default tidak dapat dihapus" };
    }
    await prisma.chatMessage.deleteMany({ where: { channelId } });
    await prisma.chatChannel.delete({ where: { id: channelId } });
    return { success: true };
  } catch (error: any) {
    console.error("Gagal menghapus channel:", error);
    return { success: false, error: error?.message };
  }
}

export async function getChatMessages(channelId: string) {
  try {
    await ensureDatabaseTables();
    return await prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil pesan chat:", error);
    try {
      await ensureDatabaseTables(true);
      return await prisma.chatMessage.findMany({
        where: { channelId },
        orderBy: { createdAt: "asc" },
      });
    } catch {
      return [];
    }
  }
}

export async function sendChatMessage(data: {
  channelId: string;
  sender: string;
  senderId?: string;
  senderImage?: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
}) {
  try {
    await ensureDatabaseTables();
    const newMsg = await prisma.chatMessage.create({
      data: {
        channelId: data.channelId,
        sender: data.sender,
        senderId: data.senderId || null,
        senderImage: data.senderImage || null,
        text: data.text || null,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null,
      },
    });
    return { success: true, message: newMsg };
  } catch (error: any) {
    console.warn("Gagal menyimpan chat dengan create(), mencoba self-healing tabel & retry:", error);
    try {
      // Pastikan kolom-kolom ChatMessage ada di PostgreSQL
      await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderId" TEXT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderImage" TEXT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "text" TEXT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileType" TEXT;`);

      const retryMsg = await prisma.chatMessage.create({
        data: {
          channelId: data.channelId,
          sender: data.sender,
          senderId: data.senderId || null,
          senderImage: data.senderImage || null,
          text: data.text || null,
          fileUrl: data.fileUrl || null,
          fileType: data.fileType || null,
        },
      });
      return { success: true, message: retryMsg };
    } catch (retryError: any) {
      console.warn("Retry create gagal, mencoba raw SQL fallback:", retryError);
      try {
        const id = "msg_" + Math.random().toString(36).substring(2, 11);
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ChatMessage" ("id", "channelId", "sender", "senderId", "senderImage", "text", "fileUrl", "fileType", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          id,
          data.channelId,
          data.sender,
          data.senderId || null,
          data.senderImage || null,
          data.text || null,
          data.fileUrl || null,
          data.fileType || null
        );
        return {
          success: true,
          message: {
            id,
            channelId: data.channelId,
            sender: data.sender,
            senderId: data.senderId || null,
            senderImage: data.senderImage || null,
            text: data.text || null,
            fileUrl: data.fileUrl || null,
            fileType: data.fileType || null,
            createdAt: new Date().toISOString(),
          },
        };
      } catch (rawError: any) {
        // Fallback paling aman: simpan dengan kolom dasar jika senderId ditolak oleh DB
        try {
          const id = "msg_" + Math.random().toString(36).substring(2, 11);
          await prisma.$executeRawUnsafe(
            `INSERT INTO "ChatMessage" ("id", "channelId", "sender", "text", "fileUrl", "fileType", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            id,
            data.channelId,
            data.sender,
            data.text || null,
            data.fileUrl || null,
            data.fileType || null
          );
          return {
            success: true,
            message: {
              id,
              channelId: data.channelId,
              sender: data.sender,
              senderId: data.senderId || null,
              senderImage: data.senderImage || null,
              text: data.text || null,
              fileUrl: data.fileUrl || null,
              fileType: data.fileType || null,
              createdAt: new Date().toISOString(),
            },
          };
        } catch (finalError: any) {
          console.error("Gagal total kirim pesan:", finalError);
          return { success: false, error: error?.message || finalError?.message };
        }
      }
    }
  }
}


// ==========================================
// 4. ATTENDANCE / PRESENSI ACTIONS
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
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

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
// 5. CALENDAR ACTIONS
// ==========================================

export async function createCalendarEvent(data: {
  title: string;
  client: string;
  date: string;
  time: string;
  assignees: string[];
  eventType?: "online" | "offline" | string | null;
  meetLink?: string | null;
  location?: string | null;
  creatorName?: string | null;
}) {
  try {
    // Siapkan initial approval status
    const initialApprovals: Record<string, string> = {};
    if (data.creatorName) {
      initialApprovals[data.creatorName] = "accepted";
    }
    data.assignees.forEach((assignee) => {
      if (assignee !== data.creatorName && assignee !== "You") {
        initialApprovals[assignee] = "pending";
      }
    });

    const event = await prisma.calendarEvent.create({
      data: {
        id: crypto.randomUUID(),
        title: data.title,
        client: data.client,
        date: data.date,
        time: data.time,
        assignees: data.assignees,
        eventType: data.eventType || "online",
        meetLink: data.meetLink || null,
        location: data.location || null,
        creatorName: data.creatorName || null,
        approvals: initialApprovals,
      },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, event };
  } catch (error: any) {
    console.error("Gagal createCalendarEvent:", error);
    return { 
      success: false, 
      error: error?.message || "Gagal menyimpan jadwal ke database Supabase." 
    };
  }
}

export async function updateCalendarEvent(
  id: string,
  data: {
    title: string;
    client: string;
    date: string;
    time: string;
    assignees: string[];
    eventType?: "online" | "offline" | string | null;
    meetLink?: string | null;
    location?: string | null;
    creatorName?: string | null;
  }
) {
  try {
    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        client: data.client,
        date: data.date,
        time: data.time,
        assignees: data.assignees,
        eventType: data.eventType || "online",
        meetLink: data.meetLink || null,
        location: data.location || null,
        ...(data.creatorName ? { creatorName: data.creatorName } : {}),
      },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, updated };
  } catch (error: any) {
    console.error("Gagal updateCalendarEvent:", error);
    return { 
      success: false, 
      error: error?.message || "Gagal mengupdate jadwal di database." 
    };
  }
}

export async function respondCalendarEventApprovalAction(
  eventId: string,
  userName: string,
  status: "accepted" | "rejected"
) {
  try {
    const ev = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
    if (!ev) return { success: false, error: "Jadwal tidak ditemukan" };

    const currentApprovals = ((ev.approvals as Record<string, string>) || {});
    currentApprovals[userName] = status;

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { approvals: currentApprovals },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, status };
  } catch (error: any) {
    console.error("Gagal update persetujuan jadwal:", error);
    return { success: false, error: error?.message };
  }
}

export async function getCalendarEvents() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    return events;
  } catch (error) {
    console.error("Gagal mengambil event kalender:", error);
    return [];
  }
}

export async function deleteCalendarEvent(id: string) {
  try {
    await prisma.calendarEvent.delete({
      where: { id },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus event kalender:", error);
    return { success: false, error: "Gagal menghapus jadwal." };
  }
}

// ==========================================
// 6. REALTIME TASK & BRIEF ACTIONS
// ==========================================

export async function getTasksAction() {
  try {
    await ensureDatabaseTables();
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    console.error("Gagal mengambil tasks dari database:", error);
    return [];
  }
}

export async function getTaskByIdAction(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
    });
    return task;
  } catch (error) {
    console.error("Gagal mengambil task by id:", error);
    return null;
  }
}

export async function createTaskAction(data?: {
  title?: string;
  client?: string;
  type?: string;
  status?: string;
  assignee?: string;
  assignedBy?: string;
  dueDate?: string;
  brief?: string;
}) {
  try {
    await ensureDatabaseTables();
    const newTask = await prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        title: data?.title?.trim() || "Untitled Task",
        client: data?.client || "General",
        type: data?.type || "Feeds",
        status: data?.status || "todo",
        assignee: data?.assignee || "Member",
        assignedBy: data?.assignedBy || null,
        dueDate: data?.dueDate || null,
        brief: data?.brief || "",
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, task: newTask };
  } catch (error: any) {
    console.error("Gagal membuat task baru:", error);
    return { success: false, error: error?.message || "Gagal membuat task." };
  }
}

export async function updateTaskStatusAction(id: string, status: "todo" | "in_progress" | "done") {
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, task: updated };
  } catch (error: any) {
    console.error("Gagal update status task:", error);
    return { success: false, error: error?.message };
  }
}

export async function updateTaskAction(
  id: string,
  data: {
    title?: string;
    client?: string;
    type?: string;
    status?: string;
    assignee?: string;
    dueDate?: string;
    brief?: string;
  }
) {
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.client ? { client: data.client } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.assignee ? { assignee: data.assignee } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.brief !== undefined ? { brief: data.brief } : {}),
      },
    });

    revalidatePath("/tasks");
    return { success: true, task: updated };
  } catch (error: any) {
    console.error("Gagal update task:", error);
    return { success: false, error: error?.message };
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal delete task:", error);
    return { success: false, error: error?.message };
  }
}

// ==========================================
// 7. REALTIME NOTULEN MOM (MINUTES OF MEETING)
// ==========================================

export async function getMomNoteAction(eventId: string) {
  try {
    const note = await prisma.momNote.findUnique({
      where: { eventId },
    });
    return note;
  } catch (error) {
    console.error("Gagal mengambil notulen MoM:", error);
    return null;
  }
}

export async function saveMomNoteAction(eventId: string, content: string, title?: string) {
  try {
    const note = await prisma.momNote.upsert({
      where: { eventId },
      update: {
        content,
        ...(title ? { title } : {}),
      },
      create: {
        id: crypto.randomUUID(),
        eventId,
        title: title || "Minutes of Meeting",
        content,
      },
    });

    revalidatePath(`/mom/${eventId}`);
    return { success: true, note };
  } catch (error: any) {
    console.error("Gagal menyimpan notulen MoM:", error);
    return { success: false, error: error?.message };
  }
}

// ==========================================
// 8. CLIENT ACTIONS
// ==========================================

export async function getClientsAction() {
  try {
    let clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
    });

    // Seed default clients jika database masih kosong
    if (clients.length === 0) {
      const defaults = [
        { name: "AKASA LAND", color: "sky" },
        { name: "APERIO", color: "indigo" },
        { name: "BALI FINE GALLERY", color: "teal" },
        { name: "WEARLUCA", color: "sage" },
        { name: "General", color: "slate" },
      ];
      for (const d of defaults) {
        await prisma.client.upsert({
          where: { name: d.name },
          update: {},
          create: { id: crypto.randomUUID(), name: d.name, color: d.color },
        });
      }
      clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    }

    return clients;
  } catch (error) {
    console.error("Gagal mengambil data clients:", error);
    return [];
  }
}

export async function createClientAction(data: { name: string; color?: string }) {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) return { success: false, error: "Nama client tidak boleh kosong" };

    const client = await prisma.client.upsert({
      where: { name: trimmedName },
      update: {
        ...(data.color ? { color: data.color } : {}),
      },
      create: {
        id: crypto.randomUUID(),
        name: trimmedName,
        color: data.color || "slate",
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, client };
  } catch (error: any) {
    console.error("Gagal membuat/update client:", error);
    return { success: false, error: error?.message || "Gagal menyimpan client." };
  }
}

export async function updateClientAction(id: string, data: { name: string; color: string }) {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) return { success: false, error: "Nama client tidak boleh kosong" };

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Client tidak ditemukan" };

    const oldName = existing.name;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: trimmedName,
        color: data.color,
      },
    });

    // Perbarui nama client di semua task dan jadwal kalender terkait jika nama berubah
    if (oldName !== trimmedName) {
      await prisma.task.updateMany({
        where: { client: oldName },
        data: { client: trimmedName },
      });
      await prisma.calendarEvent.updateMany({
        where: { client: oldName },
        data: { client: trimmedName },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, client: updated };
  } catch (error: any) {
    console.error("Gagal update client:", error);
    return { success: false, error: error?.message || "Gagal mengupdate client." };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await prisma.client.delete({ where: { id } });
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal menghapus client:", error);
    return { success: false, error: error?.message };
  }
}