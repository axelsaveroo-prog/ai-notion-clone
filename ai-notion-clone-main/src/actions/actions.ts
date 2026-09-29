"use server";

import { auth } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import db from "@/db";
import { documents, users, usersToDocuments } from "@/db/schema";
import liveblocks from "@/lib/liveblocks";

export async function createNewDocumentAction() {
    try {
        await auth.protect();
        const { sessionClaims } = await auth();
        if (sessionClaims === null) {
            throw new Error("Null session claims");
        }
        const documentId = await db.transaction(async (tx) => {
            // create a user if not exists, on conflict do nothing
            await tx
                .insert(users)
                .values({
                    id: sessionClaims.sub,
                    email: sessionClaims.email,
                })
                .onConflictDoNothing({ target: [users.id] });

            // create a doc and return it's id
            const [doc] = await tx
                .insert(documents)
                .values({ title: "New Doc" })
                .returning();

            // create the relation between the user and the doc
            await tx.insert(usersToDocuments).values({
                documentId: doc.id,
                userId: sessionClaims.sub,
                role: "owner",
            });
            return doc.id;
        });

        return { docId: documentId };
    } catch (e) {
        console.error(e);
        return { error: "Error while creating the document" };
    }
}

export async function fetchDocumentsFromUser() {
    try {
        await auth.protect();

        const { sessionClaims } = await auth();
        if (sessionClaims === null) {
            return { error: "Null session claims" };
        }

        const docs = await db
            .select({
                documentId: usersToDocuments.documentId,
                role: usersToDocuments.role,
                createdAt: usersToDocuments.createdAt,
                documentTitle: documents.title,
            })
            .from(usersToDocuments)
            .leftJoin(documents, eq(usersToDocuments.documentId, documents.id))
            .where(eq(usersToDocuments.userId, sessionClaims.sub))
            .orderBy(asc(documents.createdAt));

        return { docs: docs };
    } catch (e) {
        console.error(e);
        return { error: "error fetching the data" };
    }
}

export async function fetchUsersFromDocument(documentId: string) {
    // TODO: validate roomId
    try {
        await auth.protect();

        const { sessionClaims } = await auth();
        if (sessionClaims === null) {
            return { error: "Null session claims" };
        }

        // this need userId, role and user email
        const docs = await db
            .select({
                userId: usersToDocuments.userId,
                role: usersToDocuments.role,
                userEmail: users.email,
            })
            .from(usersToDocuments)
            .leftJoin(users, eq(users.id, usersToDocuments.userId))
            .where(eq(usersToDocuments.documentId, documentId));

        return { docs: docs };
    } catch (e) {
        console.error(e);
        return { error: "error fetching the data" };
    }
}

const parseUpdateDocumentData = z.object({
    newTitle: z.string().min(1),
    documentId: z.string().uuid(),
});

export async function updateDocumentTitleAction(unparsedData: {
    newTitle: string;
    documentId: string;
}) {
    try {
        // Validade Data with zod
        const data = parseUpdateDocumentData.parse(unparsedData);

        // Validate user
        await auth.protect();
        const { sessionClaims } = await auth();
        if (sessionClaims === null) {
            return { error: "Null session claims" };
        }

        // check if the user can update the title first
        const result = await db
            .select({ docId: usersToDocuments.documentId })
            .from(usersToDocuments)
            .where(
                and(
                    eq(usersToDocuments.documentId, data.documentId),
                    eq(usersToDocuments.userId, sessionClaims.sub)
                )
            );
        if (result.length === 0) {
            return { error: "Unauthorized" };
        }

        // update the document title
        await db
            .update(documents)
            .set({ title: data.newTitle })
            .where(eq(documents.id, data.documentId));
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "error fetching the data" };
    }
}

export async function deleteDocumentAction(roomId: string): Promise<{
    success: boolean;
}> {
    // Validate user
    await auth.protect();
    const { sessionClaims } = await auth();
    if (sessionClaims === null) {
        return { success: false };
    }
    console.log(`deleteDocument: ${roomId}`);
    try {
        // validate that the session user is the owner of current room
        const isOwner = await db
            .select({ something: usersToDocuments.userId })
            .from(usersToDocuments)
            .where(
                and(
                    eq(usersToDocuments.userId, sessionClaims.sub),
                    eq(usersToDocuments.documentId, roomId),
                    eq(usersToDocuments.role, "owner")
                )
            );
        if (isOwner.length === 0) {
            // User is unauthenticated
            return { success: false };
        }

        // delete the document inside a transaction
        await db.transaction(async (tx) => {
            await tx.delete(documents).where(eq(documents.id, roomId));
            try {
                await liveblocks.deleteRoom(roomId);
            } catch (e) {
                console.error(e);
                tx.rollback();
            }
            // is this better than not using a transaction? maybe not
        });

        return { success: true };
    } catch (err) {
        console.error(err);
        return { success: false };
    }
}

export async function inviteUserToDocumentAction({
    documentId,
    userEmail,
}: {
    documentId: string;
    userEmail: string;
}): Promise<{
    success: boolean;
}> {
    // TODO: validate the data using zod
    // Validate user
    await auth.protect();
    const { sessionClaims } = await auth();
    if (sessionClaims === null) {
        return { success: false };
    }
    // Validate that the user isn't adding himself
    if (userEmail === sessionClaims.email) {
        return { success: false };
    }

    console.log(`inviteUser: ${userEmail}`);

    try {
        // validate that the session user is the owner of current document, this validates too that the document exists
        const isOwner = await db
            .select({ something: usersToDocuments.userId })
            .from(usersToDocuments)
            .where(
                and(
                    eq(usersToDocuments.userId, sessionClaims.sub),
                    eq(usersToDocuments.documentId, documentId),
                    eq(usersToDocuments.role, "owner")
                )
            );
        if (isOwner.length === 0) {
            // User is unauthenticated
            return { success: false };
        }

        // create a invitation for the user
        const invitedUserId = await db
            .select({ userId: users.id })
            .from(users)
            .where(eq(users.email, userEmail));

        if (invitedUserId.length === 0) {
            // the problem here is that the user that is being invited needs to create a docs first
            console.error("invited user don't exists");
            return { success: false };
        }
        await db.insert(usersToDocuments).values({
            documentId: documentId,
            userId: invitedUserId[0].userId,
            role: "editor",
        });

        return { success: true };
    } catch (err) {
        console.error(err);
        return { success: false };
    }
}

export async function removeUserFromDocumentAction({
    documentId,
    userId,
}: {
    documentId: string;
    userId: string;
}): Promise<{
    success: boolean;
}> {
    // TODO: validate the data using zod
    // Validate user
    await auth.protect();
    const { sessionClaims } = await auth();
    if (sessionClaims === null) {
        return { success: false };
    }
    // Validate that the user isn't removing himself
    if (userId === sessionClaims.sub) {
        return { success: false };
    }

    console.log(`remove invite from user: ${userId}`);

    try {
        // validate that the session user is the owner of current document, this validates too that the document exists
        const isOwner = await db
            .select({ something: usersToDocuments.userId })
            .from(usersToDocuments)
            .where(
                and(
                    eq(usersToDocuments.userId, sessionClaims.sub),
                    eq(usersToDocuments.documentId, documentId),
                    eq(usersToDocuments.role, "owner")
                )
            );
        if (isOwner.length === 0) {
            // User is unauthenticated
            return { success: false };
        }

        await db
            .delete(usersToDocuments)
            .where(
                and(
                    eq(usersToDocuments.documentId, documentId),
                    eq(usersToDocuments.userId, userId)
                )
            );

        return { success: true };
    } catch (err) {
        console.error(err);
        return { success: false };
    }
}
