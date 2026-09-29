"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// --- TASKS ACTIONS ---
export async function getTasks() {
  try {
    return await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    return [];
  }
}

export async function createTask(formData: {
  title: string;
  client: string;
  dueDate: string;
  assignedBy: string;
}) {
  const newTask = await prisma.task.create({
    data: {
      title: formData.title,
      client: formData.client,
      status: "todo",
      assignedDate: new Date().toISOString().split("T")[0],
      dueDate: formData.dueDate,
      assignedBy: formData.assignedBy,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
  return newTask;
}

export async function updateTaskStatus(id: string, status: string) {
  const updated = await prisma.task.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
  return updated;
}

// --- EVENTS ACTIONS ---
export async function getEvents() {
  try {
    return await prisma.event.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    return [];
  }
}

export async function createEvent(formData: {
  title: string;
  date: string;
  client: string;
  assignee: string;
}) {
  const newEvent = await prisma.event.create({
    data: {
      title: formData.title,
      date: formData.date,
      time: "09:00 AM",
      client: formData.client,
      assignee: formData.assignee,
    },
  });
  revalidatePath("/calendar");
  revalidatePath("/");
  return newEvent;
}
