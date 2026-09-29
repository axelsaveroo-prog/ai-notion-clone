"use client";

import { PointerEvent, ReactNode } from "react";

import { useMyPresence, useOthers } from "@liveblocks/react/suspense";

import FollowPointer from "@/components/follow-pointer";

type LiveCursorProviderType = {
    children: ReactNode;
};
export default function LiveCursorProvider({
    children,
}: LiveCursorProviderType) {
    const [, updateMyPresence] = useMyPresence();
    const others = useOthers();
    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        //Update from ClientX and ClientY to PageX and PageY for full page cursor tracking
        const cursor = { x: Math.floor(e.pageX), y: Math.floor(e.pageY) };
        updateMyPresence({ cursor });
    };
    const handlePointerLeave = () => {
        updateMyPresence({ cursor: null });
    };
    return (
        <div
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
        >
            {/* Render cursors */}
            {others
                .filter((other) => other.presence.cursor !== null)
                .map(({ connectionId, presence, info }) => (
                    <FollowPointer
                        key={connectionId}
                        info={info}
                        x={presence.cursor!.x}
                        y={presence.cursor!.y}
                    />
                ))}
            {children}
        </div>
    );
}
