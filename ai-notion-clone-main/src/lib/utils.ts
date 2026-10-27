import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function stripAllTags(text: string): string {
    let result = "";
    const resultArr = [];
    let ignore = false;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] == ">") {
            ignore = false;
            continue;
        }
        if (text[i] == "<") {
            if (result.length !== 0) {
                resultArr.push(result);
                result = "";
            }
            ignore = true;
            continue;
        }
        if (ignore) continue;
        result += text[i];
    }

    return resultArr.join("\n");
}

export function getGoogleCalendarUrl(event: {
    title: string;
    date: string;
    time?: string;
    client?: string;
    assignees?: string[];
    eventType?: string | null;
    meetLink?: string | null;
    location?: string | null;
}): string {
    const titleText = `[${event.client || "Sika"}] ${event.title}`;
    
    // Format tanggal Google Calendar (YYYYMMDD)
    const cleanDate = (event.date || "").replace(/-/g, "");
    let datesParam = `${cleanDate}/${cleanDate}`;

    if (event.time && event.time.includes(":")) {
        const [hh, mm] = event.time.split(":");
        const startHour = parseInt(hh, 10);
        const endHour = (startHour + 1) % 24;
        const startStr = `${cleanDate}T${String(startHour).padStart(2, "0")}${mm}00`;
        const endStr = `${cleanDate}T${String(endHour).padStart(2, "0")}${mm}00`;
        datesParam = `${startStr}/${endStr}`;
    }

    const isOnline = event.eventType !== "offline";
    const loc = isOnline 
        ? (event.meetLink || "Online Meeting (Google Meet)") 
        : (event.location || "Kantor Sika, Semarang");

    const details = [
        `Client: ${event.client || "Internal"}`,
        `Format: ${isOnline ? "Online Meeting" : "Offline Meeting"}`,
        isOnline && event.meetLink ? `Meeting Link: ${event.meetLink}` : null,
        !isOnline && event.location ? `Lokasi: ${event.location}` : null,
        event.assignees && event.assignees.length > 0 ? `Assignees: ${event.assignees.join(", ")}` : null,
        `Sika Creative OS Workspace`,
    ].filter(Boolean).join("\n");

    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: titleText,
        dates: datesParam,
        details: details,
        location: loc,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

