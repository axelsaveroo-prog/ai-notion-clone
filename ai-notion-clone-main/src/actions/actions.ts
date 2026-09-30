// @ts-nocheck
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. USER SYNCHRONIZATION
// ==========================================

export async function syncUserAction() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return null;

    const email = user.emailAddresses[0]?.emailAddress || "";
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || email;
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
    return await prisma.user.findMany({
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil data users:", error);
    return [];
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