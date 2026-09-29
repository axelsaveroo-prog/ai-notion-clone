// @ts-nocheck
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTasks() {
  try {
    return await prisma.scheduleEvent.findMany({
      orderBy: { date: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil task:", error);
    return [];
  }
}

export async function createTask(formData: {
  title: string;
  client: string;
  dueDate: string;
  assignedBy: string;
}) {
  const newTask = await prisma.scheduleEvent.create({
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
  const updated = await prisma.scheduleEvent.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  return updated;
}

export async function deleteTask(id: string) {
  await prisma.scheduleEvent.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/");
}