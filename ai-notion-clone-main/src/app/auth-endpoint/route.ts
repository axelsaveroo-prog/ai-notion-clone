import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import db from "@/db";
import { usersToDocuments } from "@/db/schema";
import liveblocks from "@/lib/liveblocks";

export async function POST(req: NextRequest) {
    await auth.protect(); // ensures the user is authenticated
    const { sessionClaims } = await auth();
    if (sessionClaims === null) {
        return new Response("unauthorized", {
            status: 401,
        });
    }
    // get roomId from liveBlocks
    const { room } = await req.json();

    const session = liveblocks.prepareSession(sessionClaims.email, {
        userInfo: {
            name: sessionClaims.fullName,
            email: sessionClaims.email,
            avatar: sessionClaims.image,
        },
    });

    try {
        const usersInRoom = await db
            .select()
            .from(usersToDocuments)
            .where(eq(usersToDocuments.userId, sessionClaims.sub));

        const userInRoom = usersInRoom.find((doc) => doc.documentId === room);

        if (userInRoom !== undefined) {
            session.allow(room, session.FULL_ACCESS);
            const { body, status } = await session.authorize();
            console.log("you are authorized");
            return new Response(body, { status });
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { message: "Database Error" },
            { status: 403 }
        );
    }

    return NextResponse.json(
        { message: "You are not in this room" },
        { status: 403 }
    );
}
