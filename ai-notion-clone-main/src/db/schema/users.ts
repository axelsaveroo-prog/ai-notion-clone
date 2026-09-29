import { InferInsertModel, InferSelectModel, relations } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";

import usersToDocuments from "./users-to-documents";

const usersTable = pgTable("users", {
    id: text().primaryKey().notNull(),
    email: varchar({ length: 320 }).notNull(),
});

export const usersRelations = relations(usersTable, ({ many }) => ({
    usersToDocuments: many(usersToDocuments),
}));

export type User = InferSelectModel<typeof usersTable>;
export type InsertUser = InferInsertModel<typeof usersTable>;

export default usersTable;
