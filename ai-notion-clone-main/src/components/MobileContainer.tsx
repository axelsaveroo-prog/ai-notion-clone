"use client";

import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TeamChatSidebar } from "@/components/TeamChatSidebar";
import { syncUserAction } from "@/actions/actions";

export function MobileContainer({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        syncUserAction().catch(() => {});
    }, []);

    return (
        <div className="min-h-screen bg-[#0b0b0c] text-gray-100 flex flex-col selection:bg-orange-500">
            <div className="w-full max-w-[1400px] mx-auto flex-1 flex flex-col px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
                {children}
            </div>
            <TeamChatSidebar/>
            <BottomNav />
        </div>
    );
}
