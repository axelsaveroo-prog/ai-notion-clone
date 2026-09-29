import { ReactNode } from "react";

import { auth } from "@clerk/nextjs/server";

import RoomProvider from "@/components/providers/room-provider";

type DocLayoutType = {
    children: ReactNode;
    params: Promise<{ id: string }>;
};

export default async function DocLayout({ children, params }: DocLayoutType) {
    const { id } = await params;

    await auth.protect();
    return <RoomProvider roomId={id}>{children}</RoomProvider>;
}
