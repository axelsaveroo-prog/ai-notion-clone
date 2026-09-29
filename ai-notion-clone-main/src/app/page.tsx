"use client";

import { useState, useEffect } from "react";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";
import { StickyNotes } from "@/components/StickyNotes";
import { TodayScheduleReminder } from "@/components/TodayScheduleReminder";
import { syncUserAction } from "@/actions/actions";

export default function Home() {
  const [isAppDomain, setIsAppDomain] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Jalankan sync user otomatis begitu komponen di-mount di browser
  useEffect(() => {
    async function initUser() {
      try {
        await syncUserAction();
      } catch (error) {
        console.error("Gagal sync user:", error);
      } finally {
        setIsAppLoading(false);
      }
    }
    initUser();
  }, []);

  return (
    <MobileContainer>
      <main className="flex-1 flex flex-col gap-6 py-6 pb-28 text-zinc-200">
        <TodayScheduleReminder />
        <StickyNotes />
        <ForYouKanban />
        <TeamCalendar />
      </main>
    </MobileContainer>
  );
}