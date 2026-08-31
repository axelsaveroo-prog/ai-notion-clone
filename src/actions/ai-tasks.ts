"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";

export async function handleAITaskCommand(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();

  // Example: "mark all tasks for Project Alpha as done"
  if (lowerPrompt.includes("mark") && lowerPrompt.includes("done")) {
    // Extract project name roughly or update matching tasks
    await db
      .update(tasks)
      .set({ completed: true })
      .where(ilike(tasks.projectName, "%Alpha%")); // You can make this dynamic later!

    return { success: true, message: "Successfully marked Project Alpha tasks as done!" };
  }

  return { success: false, message: "AI didn't understand that command yet." };
}
