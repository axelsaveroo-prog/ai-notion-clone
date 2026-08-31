"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Clock, User } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      {/* Floating Pill Container */}
      <nav className="pointer-events-auto bg-[#161618]/90 backdrop-blur-lg border border-[#27272a] rounded-full p-2 shadow-2xl flex items-center gap-2">
        
        {/* 1. Home */}
        <Link
          href="/"
          className={`p-3 rounded-full transition-all ${
            pathname === "/" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Home"
        >
          <Home className="w-5 h-5" />
        </Link>

        {/* 2. Calendar */}
        <Link
          href="/calendar"
          className={`p-3 rounded-full transition-all ${
            pathname === "/calendar" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Calendar"
        >
          <Calendar className="w-5 h-5" />
        </Link>

        {/* 3. Attendance (Center Highlighted Icon style) */}
        <Link
          href="/attendance"
          className={`p-4 rounded-full transition-all ${
            pathname === "/attendance" || pathname === "/" // Or highlight when active
              ? "bg-[#f97316] text-black shadow-lg scale-110 font-bold"
              : "bg-[#222226] text-orange-400 hover:bg-[#2a2a2e]"
          }`}
          title="Attendance"
        >
          <Clock className="w-6 h-6" />
        </Link>

        {/* 4. Calendar (Repeated as requested) */}
        <Link
          href="/calendar"
          className={`p-3 rounded-full transition-all ${
            pathname === "/calendar" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Calendar"
        >
          <Calendar className="w-5 h-5" />
        </Link>

        {/* 5. User */}
        <Link
          href="/user"
          className={`p-3 rounded-full transition-all ${
            pathname === "/user" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="User Profile"
        >
          <User className="w-5 h-5" />
        </Link>

      </nav>
    </div>
  );
}
