"use client";

import { useState, useEffect } from "react";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  const [isAppDomain, setIsAppDomain] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [stage, setStage] = useState<"logo" | "typing1" | "typing2">("logo");
  const [displayedText, setDisplayedText] = useState("");
  
  const fullText1 = "Welcome.";
  const fullText2 = "Something big is being built right now.";

  useEffect(() => {
    if (window.location.hostname.startsWith("app.")) {
      setIsAppDomain(true);
    }
    // Brief splash screen delay for a silky-smooth transition
    const loadingTimer = setTimeout(() => {
      setIsAppLoading(false);
    }, 600);

    return () => clearTimeout(loadingTimer);
  }, []);

  // Cinematic sequence timer for the public page
  useEffect(() => {
    if (isAppDomain) return;

    const timer = setTimeout(() => {
      setStage("typing1");
    }, 4000);

    return () => clearTimeout(timer);
  }, [isAppDomain]);

  // Typewriter effect
  useEffect(() => {
    if (isAppDomain) return;

    if (stage === "typing1") {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= fullText1.length) {
          setDisplayedText(fullText1.substring(0, i));
          i++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setStage("typing2");
            setDisplayedText("");
          }, 1200);
        }
      }, 120);
      return () => clearInterval(interval);
    }

    if (stage === "typing2") {
      let j = 0;
      const interval = setInterval(() => {
        if (j <= fullText2.length) {
          setDisplayedText(fullText2.substring(0, j));
          j++;
        } else {
          clearInterval(interval);
        }
      }, 70);
      return () => clearInterval(interval);
    }
  }, [stage, isAppDomain]);

  // APP DOMAIN: Show a color-matched splash loader while mounting
  if (isAppDomain) {
    if (isAppLoading) {
      return (
        <div className="fixed inset-0 bg-[#0b0b0c] flex items-center justify-center z-50">
          <img
            src="/touch icon sika-04.png"
            alt="Loading..."
            className="w-16 h-16 object-contain animate-pulse rounded-2xl"
          />
        </div>
      );
    }

    return (
      <MobileContainer>
        <header className="flex items-center justify-center py-6 mb-4">
          <img
            src="/Asset 2@1080x.png"
            alt="Sika Creative Logo"
            className="h-10 w-auto object-contain select-none"
          />
        </header>
        <main className="flex-1 flex flex-col gap-6 pb-20">
          <ForYouKanban />
          <TeamCalendar />
        </main>
      </MobileContainer>
    );
  }

  // MAIN DOMAIN: Public Landing Page
  return (
    <main className="relative w-screen h-screen bg-[#09090b] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
        style={{ backgroundImage: "url('/BACKGROUND WEBSITE-2.png')" }}
      />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      <div className="z-10 flex flex-col items-center justify-center text-center px-4">
        {stage === "logo" && (
          <div className="flex flex-col items-center gap-6 transition-opacity duration-1000 animate-fade-in">
            <img
              src="/Asset 2@1080x.png"
              alt="Sika Creative Studio"
              className="h-20 md:h-28 w-auto object-contain select-none drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
            />
          </div>
        )}

        {(stage === "typing1" || stage === "typing2") && (
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-gray-100 min-h-[3.5rem] flex items-center drop-shadow-md">
              {displayedText}
              <span className="inline-block w-2 h-6 md:h-8 bg-white ml-1 animate-pulse" />
            </h1>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 text-[10px] tracking-widest text-gray-400 uppercase drop-shadow">
        © {new Date().getFullYear()} Sika Creative Group. All rights reserved.
      </div>
    </main>
  );
}
