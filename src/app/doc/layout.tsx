import React from "react";

import LiveBlocksProvider from "@/components/providers/live-blocks-provider";

export default function PageLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <LiveBlocksProvider>{children}</LiveBlocksProvider>;
}
