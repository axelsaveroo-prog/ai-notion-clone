"use client";

import { ReactNode } from "react";

import {
    ClientSideSuspense,
    RoomProvider as RoomProviderWrapper,
} from "@liveblocks/react/suspense";

import LoadingSpinner from "@/components/loading-spinner";
import LiveCursorProvider from "@/components/providers/live-cursor-provider";

type RoomProviderType = {
    children: ReactNode;
    roomId: string;
};

export default function RoomProvider({ children, roomId }: RoomProviderType) {
    return (
        <RoomProviderWrapper
            id={roomId}
            initialPresence={{
                cursor: null,
            }}
        >
            <ClientSideSuspense fallback={<LoadingSpinner />}>
                <LiveCursorProvider>{children}</LiveCursorProvider>
            </ClientSideSuspense>
        </RoomProviderWrapper>
    );
}
