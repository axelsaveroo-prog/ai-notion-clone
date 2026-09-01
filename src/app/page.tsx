"use client";

import { useState, useEffect } from "react";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  const [isAppDomain, setIsAppDomain] = useState(false);
  const [stage, setStage] = useState<"logo" | "typing1" | "typing2">("logo");
  const [displayedText, setDisplayedText] = useState("");
  
  const fullText1 = "Welcome.";
  const fullText2 = "Something big is being built right now.";

  useEffect(() => {
    if (window.location.hostname.startsWith("app.")) {
      setIsAppDomain(true);
    }
  }, []);

  // Cinematic sequence timer: Increased to 4 seconds for a slower, high-end feel
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

  // IF VISITING APP DOMAIN: Render secure internal OS workspace
  if (isAppDomain) {
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

  // IF VISITING MAIN DOMAIN: Public landing page with your actual logo and slower fade
  return (
    <main className="relative w-screen h-screen bg-[#09090b] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)] pointer-events-none" />

      <div className="z-10 flex flex-col items-center justify-center text-center px-4">
        {stage === "logo" && (
          <div className="flex flex-col items-center gap-6 transition-opacity duration-1000 animate-fade-in">
            <img
              src="/Asset 2@1080x.png"
              alt="Sika Creative Studio"
              className="h-12 md:h-16 w-auto object-contain select-none opacity-90 drop-shadow-2xl transition-opacity duration-1000"
            />
          </div>
        )}

        {(stage === "typing1" || stage === "typing2") && (
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl md:text-5xl font-light tracking-tight text-gray-100 min-h-[3.5rem] flex items-center">
              {displayedText}
              <span className="inline-block w-2 h-6 md:h-8 bg-white ml-1 animate-pulse" />
            </h1>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 text-[10px] tracking-widest text-gray-600 uppercase">
        © {new Date().getFullYear()} Sika Creative Group. All rights reserved.
      </div>
    </main>
  );
}
