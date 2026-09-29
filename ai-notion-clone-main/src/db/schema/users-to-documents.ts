import { InferSelectModel, relations } from "drizzle-orm";
import {
    foreignKey,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";

import documentsTable from "./documents";
import usersTable from "./users";

export const roomRoleEnum = pgEnum("room_role_enum", ["owner", "editor"]);

// this table link a user to a document, and document to a user. it's many to many relation
// if the document is deleted, all usersToDOcuments that have this document is deleted automatically.
const usersToDocuments = pgTable(
    "users_to_documents",
    {
        userId: text()
            .notNull()
            .references(() => usersTable.id),
        documentId: uuid().notNull(),
        role: roomRoleEnum().notNull(),
        createdAt: timestamp().defaultNow().notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.documentId] }),
        foreignKey({
            name: "document_fk",
            columns: [t.documentId],
            foreignColumns: [documentsTable.id],
        }).onDelete("cascade"),
    ]
);

export const usersToDocumentsRelations = relations(
    usersToDocuments,
    ({ one }) => ({
        document: one(documentsTable, {
            fields: [usersToDocuments.documentId],
            references: [documentsTable.id],
        }),
        user: one(usersTable, {
            fields: [usersToDocuments.userId],
            references: [usersTable.id],
        }),
    })
);

export type UsersToDocument = InferSelectModel<typeof usersToDocuments>;

export interface SplitUsersToDocument<T extends UsersToDocument["role"]>
    extends Omit<UsersToDocument, "userId"> {
    role: T;
    documentTitle: string;
}

export default usersToDocuments;
