"use client";

import { useEffect, useState } from "react";

import { useUser } from "@clerk/nextjs";
import { useRoom } from "@liveblocks/react/suspense";

import useUsersInDocument from "@/hooks/use-users-in-document";

export default function useOwner(): boolean {
    const { user } = useUser();
    const room = useRoom();
    const [isOwner, setIsOwner] = useState(false);
    const { usersInDoc } = useUsersInDocument(room.id);
    useEffect(() => {
        if (usersInDoc !== undefined && usersInDoc.length > 0) {
            const owners = usersInDoc.filter((doc) => doc.role === "owner");
            if (owners.some((owner) => owner.userId === user?.id)) {
                setIsOwner(true);
            }
        }
    }, [usersInDoc, user]);
    return isOwner;
}
