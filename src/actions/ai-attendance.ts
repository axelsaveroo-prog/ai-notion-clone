"use server";

import db from "@/db";
import { attendance } from "@/db/schema";

export async function recordAttendance(type: "CHECK_IN" | "CHECK_OUT", latitude: number, longitude: number, userId: string) {
  try {
    await db.insert(attendance).values({
      id: Math.random().toString(36.substring(2, 9)),
      userId: userId,
      type: type,
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });

    return { success: true, message: `Successfully recorded ${type.toLowerCase().replace('_', ' ')}!` };
  } catch (error) {
    console.error("Attendance error:", error);
    return { success: false, message: "Failed to record attendance." };
  }
}
