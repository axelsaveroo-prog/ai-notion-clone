"use client";

import { useState, useEffect } from "react";
import { ForYouKanban } from "@/components/ForYouKanban";
import { TeamCalendar } from "@/components/TeamCalendar";
import { MobileContainer } from "@/components/MobileContainer";

export default function Home() {
  const [isAppDomain, setIsAppDomain] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [stage, setStage] = useState<"logo" | "typing1" | "typing2" | "fadeout">("logo");
  const [displayedText, setDisplayedText] = useState("");
  const [fadeAnim, setFadeAnim] = useState(true);
  
  const fullText1 = "Welcome.";
  const fullText2 = "Something big is being built right now.";

  useEffect(() => {
    if (window.location.hostname.startsWith("app.")) {
      setIsAppDomain(true);

      const hasLoadedBefore = sessionStorage.getItem("sika_app_loaded");
      if (!hasLoadedBefore) {
        setIsAppLoading(true);
        const loadingTimer = setTimeout(() => {
          setIsAppLoading(false);
          sessionStorage.setItem("sika_app_loaded", "true");
        }, 1800);

        return () => clearTimeout(loadingTimer);
      }
    }
  }, []);

  // Smooth looping cinematic sequence manager
  useEffect(() => {
    if (isAppDomain) return;

    let timeout: NodeJS.Timeout;

    if (stage === "logo") {
      setFadeAnim(true);
      timeout = setTimeout(() => {
        setFadeAnim(false);
        setTimeout(() => {
          setStage("typing1");
          setFadeAnim(true);
        }, 500); // Wait for fade out
      }, 3500);
    } else if (stage === "typing2") {
      // Wait after typing fullText2, then fade out smoothly to restart loop
      timeout = setTimeout(() => {
        setFadeAnim(false);
        setTimeout(() => {
          setDisplayedText("");
          setStage("logo");
          setFadeAnim(true);
        }, 800); // Smooth fade transition back to logo
      }, 4000);
    }

    return () => clearTimeout(timeout);
  }, [stage, isAppDomain]);

  // Typewriter effect handler
  useEffect(() => {
    if (isAppDomain) return;

    if (stage === "typing1") {
      let i = 0;
      setDisplayedText("");
      const interval = setInterval(() => {
        if (i <= fullText1.length) {
          setDisplayedText(fullText1.substring(0, i));
          i++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setFadeAnim(false);
            setTimeout(() => {
              setStage("typing2");
              setDisplayedText("");
              setFadeAnim(true);
            }, 500);
          }, 1000);
        }
      }, 120);
      return () => clearInterval(interval);
    }
  }, [stage, isAppDomain]);

  // Typewriter for second line
  useEffect(() => {
    if (isAppDomain) return;

    if (stage === "typing2") {
      let j = 0;
      setDisplayedText("");
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

  if (isAppDomain) {
    if (isAppLoading) {
      return (
        <div className="fixed inset-0 bg-[#0b0b0c] flex items-center justify-center z-50 transition-opacity duration-500">
          <img
            src="/touch icon sika-04.png"
            alt="Loading..."
            className="w-32 h-32 md:w-40 md:h-40 object-contain animate-pulse rounded-3xl drop-shadow-2xl"
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

  return (
    <main className="relative w-screen h-[100dvh] bg-[#09090b] text-white flex flex-col items-center justify-center overflow-hidden font-sans">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-100"
        style={{ backgroundImage: "url('/BACKGROUND WEBSITE-2.png')" }}
      />
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />
      
      {/* Main cinematic container with smooth opacity transitions */}
      <div className={`z-10 flex flex-col items-center justify-center text-center px-4 transition-opacity duration-700 ${fadeAnim ? "opacity-100" : "opacity-0"}`}>
        {stage === "logo" && (
          <div className="flex flex-col items-center gap-6">
            <img
              src="/Asset 2@1080x.png"
              alt="Sika Creative Studio"
              className="h-20 md:h-28 w-auto object-contain select-none"
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

      {/* Bottom text updated to white with 70% opacity */}
      <div className="absolute bottom-6 text-[10px] tracking-widest text-white/70 uppercase drop-shadow">
        © {new Date().getFullYear()} CV. SEKELOMPOK KREATOR CUAN. All rights reserved.
      </div>
    </main>
  );
}
