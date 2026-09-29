// @ts-nocheck
"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. SUPABASE REALTIME & CALENDAR ACTIONS
// ==========================================

export async function getCalendarEvents() {
  try {
    return await prisma.ScheduleEvent.findMany({
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
  const newEvent = await prisma.ScheduleEvent.create({ data });
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
  const updated = await prisma.ScheduleEvent.update({
    where: { id },
    data,
  });
  revalidatePath("/calendar");
  revalidatePath("/");
  return updated;
}

export async function deleteCalendarEvent(id: string) {
  await prisma.ScheduleEvent.delete({ where: { id } });
  revalidatePath("/calendar");
  revalidatePath("/");
}

// ==========================================
// 2. CHATBOX REALTIME ACTIONS
// ==========================================

export async function getChatMessages(channelId: string) {
  try {
    return await prisma.ChatMessage.findMany({
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
  const newMsg = await prisma.ChatMessage.create({ data });
  return newMsg;
}

// ==========================================
// 3. DOCUMENT ACTIONS (STUB FOR COMPONENT COMPATIBILITY)
// ==========================================

export async function createNewDocumentAction() {
  return { success: true, docId: "doc-" + Date.now() };
}

export async function createNewDocument() {
  return createNewDocumentAction();
}

export async function deleteDocumentAction(docId: string) {
  revalidatePath("/");
  return { success: true };
}

export async function updateDocumentTitleAction(docId: string, title: string) {
  revalidatePath(`/doc/${docId}`);
  return { success: true };
}

export async function inviteUserToDocumentAction(docId: string, email: string) {
  revalidatePath(`/doc/${docId}`);
  return { success: true };
}

export async function removeUserFromDocumentAction(docId: string, email: string) {
  revalidatePath(`/doc/${docId}`);
  return { success: true };
}

export async function fetchUsersFromDocument(docId: string) {
  return { docs: [], error: null };
}

export async function fetchDocumentsFromUser() {
  return { docs: [], error: null };
}