import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";

export const attendance = pgTable("attendance", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "CHECK_IN" or "CHECK_OUT"
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
