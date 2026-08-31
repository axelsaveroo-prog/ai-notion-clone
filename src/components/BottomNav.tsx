"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Clock, Calendar, User, Menu } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      {/* Floating Pill Container matching your reference video */}
      <nav className="pointer-events-auto bg-[#161618]/95 backdrop-blur-md border border-[#27272a] rounded-full px-4 py-2.5 shadow-2xl flex items-center gap-3">
        
        {/* 1. Menu / Home (Far Left) */}
        <Link
          href="/"
          className={`p-2.5 rounded-full transition-all ${
            pathname === "/" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Home Menu"
        >
          <Menu className="w-5 h-5" />
        </Link>

        {/* 2. Tasks (Second button from the left) */}
        <Link
          href="/tasks"
          className={`p-2.5 rounded-full transition-all ${
            pathname === "/tasks" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Tasks"
        >
          <CheckSquare className="w-5 h-5" />
        </Link>

        {/* 3. Attendance (Center Highlighted Icon style from video) */}
        <Link
          href="/attendance"
          className={`p-3.5 rounded-full transition-all shadow-lg scale-110 ${
            pathname === "/attendance" || pathname === "/"
              ? "bg-[#f97316] text-black font-bold"
              : "bg-[#222226] text-orange-400 hover:bg-[#2a2a2e]"
          }`}
          title="Attendance (GPS)"
        >
          <Clock className="w-5 h-5" />
        </Link>

        {/* 4. Calendar */}
        <Link
          href="/calendar"
          className={`p-2.5 rounded-full transition-all ${
            pathname === "/calendar" ? "bg-[#f97316] text-black shadow-md scale-105" : "text-gray-400 hover:text-white hover:bg-[#222226]"
          }`}
          title="Calendar"
        >
          <Calendar className="w-5 h-5" />
        </Link>

        {/* 5. User Profile */}
        <Link
          href="/user"
          className={`p-2.5 rounded-full transition-all ${
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
