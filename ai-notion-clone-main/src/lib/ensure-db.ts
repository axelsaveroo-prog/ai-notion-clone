import { prisma } from "@/lib/prisma";

let isDbInitialized = false;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ScheduleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "assignees" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderId" TEXT,
    "senderImage" TEXT,
    "text" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ChatChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'group',
    "description" TEXT,
    "members" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageUrl" TEXT,
    "location" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "assignees" TEXT[],
    "eventType" TEXT DEFAULT 'online',
    "meetLink" TEXT,
    "location" TEXT,
    "creatorName" TEXT,
    "approvals" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT 'General',
    "type" TEXT DEFAULT 'Feeds',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "assignee" TEXT DEFAULT 'You',
    "assignedBy" TEXT,
    "dueDate" TEXT,
    "brief" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "MomNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL UNIQUE,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'New Doc',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "UsersToDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_channelId_idx" ON "ChatMessage"("channelId")`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Attendance_userId_idx" ON "Attendance"("userId")`,
  `CREATE INDEX IF NOT EXISTS "Attendance_timestamp_idx" ON "Attendance"("timestamp")`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderId" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderImage" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "text" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileType" TEXT`,
  `ALTER TABLE "ChatChannel" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'group'`,
  `ALTER TABLE "ChatChannel" ADD COLUMN IF NOT EXISTS "description" TEXT`,
  `ALTER TABLE "ChatChannel" ADD COLUMN IF NOT EXISTS "members" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE "ChatChannel" ADD COLUMN IF NOT EXISTS "createdById" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT DEFAULT 'online'`,
  `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "meetLink" TEXT`,
  `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "location" TEXT`,
  `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "creatorName" TEXT`,
  `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "approvals" JSONB`,
  `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "assignedBy" TEXT`,
  `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dueDate" TEXT`,
  `ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "brief" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN DEFAULT false`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "isForwarded" BOOLEAN DEFAULT false`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToSender" TEXT`,
  `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT`,
  `ALTER TABLE "ChatChannel" ADD COLUMN IF NOT EXISTS "admins" TEXT[] DEFAULT ARRAY[]::TEXT[]`
];

export async function ensureDatabaseTables(force = false) {
  if (isDbInitialized && !force) return;
  for (const statement of DDL_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch {
      // Abaikan jika statement gagal (misal tabel/kolom/index sudah ada)
    }
  }
  isDbInitialized = true;
}
