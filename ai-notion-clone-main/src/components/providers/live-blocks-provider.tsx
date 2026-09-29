"use client";

import React from "react";

import { LiveblocksProvider } from "@liveblocks/react/suspense";

export default function LiveBlocksProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LiveblocksProvider throttle={16} authEndpoint={"/auth-endpoint"}>
            {children}
        </LiveblocksProvider>
    );
}
