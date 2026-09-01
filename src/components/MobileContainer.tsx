"use client";

import { BottomNav } from "@/components/BottomNav";

export function MobileContainer({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0b0b0c] text-gray-100 flex flex-col selection:bg-orange-500">
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col px-4 sm:px-8 py-4 sm:py-8">
                {children}
            </div>
            <BottomNav />
        </div>
    );
}
