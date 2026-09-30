"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

const ONE_HOUR_IN_MS = 60 * 60 * 1000; // 1 Jam

export function IdleLogout() {
  const { signOut } = useClerk();

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Logout otomatis jika idle 1 jam
        signOut({ redirectUrl: "/sign-in" });
      }, ONE_HOUR_IN_MS);
    };

    // Event aktivitas pengguna
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer(); // Jalankan timer pertama kali

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [signOut]);

  return null;
}