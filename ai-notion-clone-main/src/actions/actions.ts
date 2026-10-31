// @ts-nocheck
"use server";

import { auth, currentUser, createClerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ensureDatabaseTables } from "@/lib/ensure-db";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ==========================================
// 1. USER ACTIONS (CLERK & SUPABASE SYNC)
// ==========================================

export async function syncUserAction() {
  try {
    await ensureDatabaseTables();
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) return null;

    const email = user.emailAddresses[0]?.emailAddress || "";
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || email;
    const imageUrl = user.imageUrl || "";

    const dbUser = await prisma.user.upsert({
      where: { id: userId },
      update: { name, email, imageUrl, lastActiveAt: new Date() },
      create: {
        id: userId,
        email,
        name,
        imageUrl,
        lastActiveAt: new Date(),
      },
    });

    return dbUser;
  } catch (error) {
    console.error("Gagal sync user:", error);
    return null;
  }
}

export async function heartbeatAction() {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}

let lastClerkSyncTime = 0;
const CLERK_SYNC_INTERVAL = 60 * 1000; // Sinkronisasi Clerk maksimal 1 menit sekali

export async function getUsersAction() {
  try {
    // 1. Ambil dari database Supabase / Postgres terlebih dahulu (super cepat ~30-50ms)
    const dbUsers = await prisma.user.findMany({
      orderBy: { name: "asc" },
    });

    const userMap = new Map<string, { id: string; name: string; email: string; imageUrl?: string; lastActiveAt?: string | null }>();
    dbUsers.forEach((u) => {
      if (u.id) {
        userMap.set(u.id, {
          id: u.id,
          name: u.name || u.email || "Member",
          email: u.email || "",
          imageUrl: u.imageUrl || "",
          lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
        });
      }
    });

    // 2. Sinkronkan ke Clerk API secara non-blocking di background (tidak menahan response user)
    const now = Date.now();
    if (process.env.CLERK_SECRET_KEY && (dbUsers.length === 0 || now - lastClerkSyncTime > CLERK_SYNC_INTERVAL)) {
      lastClerkSyncTime = now;
      fetch("https://api.clerk.com/v1/users?limit=100", {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        cache: "no-store",
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((clerkData) => {
          if (Array.isArray(clerkData)) {
            for (const u of clerkData) {
              const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
              const displayName = fullName || u.username || u.email_addresses?.[0]?.email_address || "Member";
              const email = u.email_addresses?.[0]?.email_address || "";
              const imageUrl = u.image_url || "";

              prisma.user.upsert({
                where: { id: u.id },
                update: { name: displayName, email, imageUrl },
                create: { id: u.id, name: displayName, email, imageUrl, lastActiveAt: new Date() },
              }).catch(() => {});
            }
          }
        })
        .catch((err) => {
          console.warn("Background Clerk sync warning:", err);
        });
    }

    return Array.from(userMap.values());
  } catch (error) {
    console.error("Gagal mengambil data users:", error);
    return [];
  }
}

// ==========================================
// 2. DOCUMENT ACTIONS (NOTION CLONE)
// ==========================================

export async function createNewDocumentAction() {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const doc = await prisma.document.create({
      data: {
        title: "Untitled Document",
        usersToDocuments: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });

    revalidatePath("/");
    return doc.id;
  } catch (error) {
    console.error("Gagal membuat dokumen baru:", error);
    return null;
  }
}

export async function fetchDocumentsFromUser(userId: string) {
  try {
    const userDocs = await prisma.usersToDocument.findMany({
      where: { userId },
      include: { document: true },
    });
    return userDocs.map((item) => item.document);
  } catch (error) {
    console.error("Gagal mengambil dokumen user:", error);
    return [];
  }
}

export async function deleteDocumentAction(docId: string) {
  try {
    await prisma.document.delete({ where: { id: docId } });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus dokumen:", error);
    return { success: false };
  }
}

export async function updateDocumentTitleAction(docId: string, title: string) {
  try {
    await prisma.document.update({
      where: { id: docId },
      data: { title },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal memperbarui judul dokumen:", error);
    return { success: false };
  }
}

export async function inviteUserToDocumentAction(docId: string, email: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { success: false, message: "User tidak ditemukan" };

    await prisma.usersToDocument.create({
      data: {
        documentId: docId,
        userId: user.id,
      },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal mengundang user:", error);
    return { success: false };
  }
}

export async function removeUserFromDocumentAction(docId: string, userId: string) {
  try {
    await prisma.usersToDocument.deleteMany({
      where: {
        documentId: docId,
        userId: userId,
      },
    });
    revalidatePath(`/doc/${docId}`);
    return { success: true };
  } catch (error) {
    console.error("Gagal menghapus user dari dokumen:", error);
    return { success: false };
  }
}

export async function fetchUsersFromDocument(docId: string) {
  try {
    const usersInDoc = await prisma.usersToDocument.findMany({
      where: { documentId: docId },
      include: { user: true },
    });
    return usersInDoc.map((item) => item.user);
  } catch (error) {
    console.error("Gagal mengambil user dokumen:", error);
    return [];
  }
}

// ==========================================
// 3. CHATBOX ACTIONS (REAL GROUPS & DIRECT MESSAGES)
// ==========================================

export async function getChatChannelsAction(currentUserId?: string) {
  try {
    await ensureDatabaseTables();
    const channels = await prisma.chatChannel.findMany({
      where: {
        NOT: {
          OR: [
            { id: "general" },
            { name: { equals: "general", mode: "insensitive" } },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!channels || channels.length === 0) {
      return [];
    }

    const channelIds = channels.map((c) => c.id);
    const messages = await prisma.chatMessage.findMany({
      where: {
        channelId: { in: channelIds },
      },
      orderBy: { createdAt: "desc" },
    });

    const msgsByChannel: Record<string, any[]> = {};
    for (const m of messages) {
      if (!msgsByChannel[m.channelId]) {
        msgsByChannel[m.channelId] = [];
      }
      msgsByChannel[m.channelId].push(m);
    }

    const filteredChannels = channels.filter((c) => {
      const channelMsgs = msgsByChannel[c.id] || [];
      if (c.type === "direct") {
        if (!currentUserId) return false;
        const isMember =
          (Array.isArray(c.members) && c.members.includes(currentUserId)) ||
          c.id.includes(currentUserId);
        if (!isMember) return false;
        // Hanya tampilkan jika sudah pernah chat (ada pesan)
        return channelMsgs.length > 0;
      }
      if (c.type === "group") {
        if (!currentUserId) return false;
        // Hanya tampilkan grup jika user terdaftar sebagai anggota atau sebagai pembuat
        const isMember =
          (Array.isArray(c.members) && c.members.includes(currentUserId)) ||
          c.createdById === currentUserId;
        return isMember;
      }
      return true;
    });

    return filteredChannels.map((c) => {
      const channelMsgs = msgsByChannel[c.id] || [];
      const lastMsg = channelMsgs[0] || null;
      return {
        ...c,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              sender: lastMsg.sender,
              senderId: lastMsg.senderId,
              text: lastMsg.text,
              fileType: lastMsg.fileType,
              createdAt: lastMsg.createdAt,
            }
          : null,
        messageCount: channelMsgs.length,
      };
    });
  } catch (error) {
    console.error("Gagal mengambil saluran chat:", error);
    return [];
  }
}

export async function createChatGroupAction(data: {
  name: string;
  description?: string;
  members: string[];
  createdById?: string;
}) {
  try {
    const formattedName = data.name.trim().replace(/^#+/, "").trim();
    if (!formattedName) return { success: false, error: "Group name cannot be empty" };

    const creatorId = data.createdById || null;
    const initialAdmins = creatorId ? [creatorId] : [];
    const membersList = Array.from(new Set([...(data.members || []), ...(creatorId ? [creatorId] : [])]));

    const newChannel = await prisma.chatChannel.create({
      data: {
        id: "group_" + crypto.randomUUID(),
        name: formattedName,
        type: "group",
        description: data.description || "",
        members: membersList,
        admins: initialAdmins,
        createdById: creatorId,
      },
    });

    return { success: true, channel: newChannel };
  } catch (error: any) {
    console.error("Failed to create chat group:", error);
    return { success: false, error: error?.message || "Failed to create chat group" };
  }
}

export async function updateChatGroupAction(
  channelId: string,
  currentUserId: string,
  data: { name?: string; description?: string }
) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: false, error: "Group not found" };

    const isOwner = channel.createdById === currentUserId;
    const isAdmin = isOwner || (channel.admins && channel.admins.includes(currentUserId));
    if (!isAdmin) {
      return { success: false, error: "Only group admins can update group info" };
    }

    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      },
    });

    return { success: true, channel: updated };
  } catch (error: any) {
    console.error("Failed to update group info:", error);
    return { success: false, error: error?.message || "Failed to update group info" };
  }
}

export async function inviteChannelMembersAction(
  channelId: string,
  currentUserId: string,
  newMemberIds: string[],
  inviterName?: string,
  invitedNames?: string[]
) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: false, error: "Group not found" };

    const isOwner = channel.createdById === currentUserId;
    const isAdmin = isOwner || (channel.admins && channel.admins.includes(currentUserId));
    if (!isAdmin) {
      return { success: false, error: "Only group admins can invite members" };
    }

    const updatedMembers = Array.from(new Set([...(channel.members || []), ...newMemberIds]));
    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: { members: updatedMembers },
    });

    if (invitedNames && invitedNames.length > 0) {
      await prisma.chatMessage.create({
        data: {
          channelId,
          sender: "System",
          senderId: "system",
          text: `${inviterName || "Admin"} added ${invitedNames.join(", ")}`,
        },
      });
    }

    return { success: true, channel: updated };
  } catch (error: any) {
    console.error("Failed to invite members:", error);
    return { success: false, error: error?.message || "Failed to invite members" };
  }
}

export async function kickChannelMemberAction(
  channelId: string,
  currentUserId: string,
  targetMemberId: string,
  targetMemberName?: string
) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: false, error: "Group not found" };

    const isOwner = channel.createdById === currentUserId;
    const isAdmin = isOwner || (channel.admins && channel.admins.includes(currentUserId));
    if (!isAdmin) {
      return { success: false, error: "Only group admins can remove members" };
    }

    if (targetMemberId === channel.createdById) {
      return { success: false, error: "The group creator cannot be removed" };
    }

    const updatedMembers = (channel.members || []).filter((id) => id !== targetMemberId);
    const updatedAdmins = (channel.admins || []).filter((id) => id !== targetMemberId);

    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: {
        members: updatedMembers,
        admins: updatedAdmins,
      },
    });

    await prisma.chatMessage.create({
      data: {
        channelId,
        sender: "System",
        senderId: "system",
        text: `${targetMemberName || "A member"} was removed`,
      },
    });

    return { success: true, channel: updated };
  } catch (error: any) {
    console.error("Failed to remove member:", error);
    return { success: false, error: error?.message || "Failed to remove member" };
  }
}

export async function promoteChannelAdminAction(
  channelId: string,
  currentUserId: string,
  targetMemberId: string,
  targetMemberName?: string
) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: false, error: "Group not found" };

    const isOwner = channel.createdById === currentUserId;
    const isAdmin = isOwner || (channel.admins && channel.admins.includes(currentUserId));
    if (!isAdmin) {
      return { success: false, error: "Only group admins can promote another member to admin" };
    }

    const updatedAdmins = Array.from(new Set([...(channel.admins || []), targetMemberId]));
    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: { admins: updatedAdmins },
    });

    await prisma.chatMessage.create({
      data: {
        channelId,
        sender: "System",
        senderId: "system",
        text: `${targetMemberName || "A member"} is now an admin`,
      },
    });

    return { success: true, channel: updated };
  } catch (error: any) {
    console.error("Failed to promote admin:", error);
    return { success: false, error: error?.message || "Failed to promote admin" };
  }
}

export async function leaveChatGroupAction(channelId: string, currentUserId: string, userName?: string) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: false, error: "Group not found" };

    // The group creator cannot leave; they can delete the group instead
    if (channel.createdById === currentUserId) {
      return { success: false, error: "The group creator cannot leave the group. You can delete the group instead." };
    }

    const updatedMembers = (channel.members || []).filter((id) => id !== currentUserId);
    const updatedAdmins = (channel.admins || []).filter((id) => id !== currentUserId);

    const updated = await prisma.chatChannel.update({
      where: { id: channelId },
      data: {
        members: updatedMembers,
        admins: updatedAdmins,
      },
    });

    await prisma.chatMessage.create({
      data: {
        channelId,
        sender: "System",
        senderId: "system",
        text: `${userName || "A member"} left`,
      },
    });

    return { success: true, channel: updated };
  } catch (error: any) {
    console.error("Failed to leave group:", error);
    return { success: false, error: error?.message || "Failed to leave group" };
  }
}

export async function editChatMessageAction(
  messageId: string,
  newText: string,
  currentUserId: string
) {
  try {
    await ensureDatabaseTables();
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) return { success: false, error: "Message not found" };
    if (msg.senderId && msg.senderId !== currentUserId) {
      return { success: false, error: "Only the sender can edit this message" };
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { text: newText, isEdited: true },
    });
    return { success: true, message: updated };
  } catch (error: any) {
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE "ChatMessage" SET "text" = $1, "isEdited" = true WHERE "id" = $2',
        newText,
        messageId
      );
      return { success: true };
    } catch (rawErr: any) {
      console.error("Failed to edit chat message:", error, rawErr);
      return { success: false, error: error?.message || rawErr?.message || "Failed to edit message" };
    }
  }
}

export async function deleteChatMessageAction(messageId: string, currentUserId: string) {
  try {
    await ensureDatabaseTables();
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) return { success: false, error: "Message not found" };
    if (msg.senderId && msg.senderId !== currentUserId) {
      return { success: false, error: "Only the sender can delete this message" };
    }

    await prisma.chatMessage.delete({ where: { id: messageId } });
    return { success: true };
  } catch (error: any) {
    try {
      await prisma.$executeRawUnsafe('DELETE FROM "ChatMessage" WHERE "id" = $1', messageId);
      return { success: true };
    } catch (rawErr: any) {
      console.error("Failed to delete chat message:", error, rawErr);
      return { success: false, error: error?.message || rawErr?.message || "Failed to delete message" };
    }
  }
}

export async function getOrCreateDirectChannelAction(
  user1Id: string,
  user1Name: string,
  user2Id: string,
  user2Name: string
) {
  try {
    const sortedIds = [user1Id, user2Id].sort();
    const channelId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

    let channel = await prisma.chatChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      channel = await prisma.chatChannel.create({
        data: {
          id: channelId,
          name: `${user1Name} & ${user2Name}`,
          type: "direct",
          members: [user1Id, user2Id],
        },
      });
    }

    return { success: true, channel };
  } catch (error: any) {
    console.error("Gagal membuat/mengambil DM channel:", error);
    return { success: false, error: error?.message };
  }
}

export async function deleteChatChannelAction(channelId: string, currentUserId?: string) {
  try {
    await ensureDatabaseTables();
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel) return { success: true };

    if (currentUserId && channel.createdById) {
      const isOwner = channel.createdById === currentUserId;
      const isAdmin = isOwner || (channel.admins && channel.admins.includes(currentUserId));
      if (!isAdmin) {
        return { success: false, error: "Only group admins can delete this group" };
      }
    }

    await prisma.chatMessage.deleteMany({ where: { channelId } });
    await prisma.chatChannel.delete({ where: { id: channelId } });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete channel:", error);
    return { success: false, error: error?.message || "Failed to delete channel" };
  }
}

export async function getChatMessages(channelId: string) {
  try {
    await ensureDatabaseTables();
    return await prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Gagal mengambil pesan chat:", error);
    try {
      await ensureDatabaseTables(true);
      return await prisma.chatMessage.findMany({
        where: { channelId },
        orderBy: { createdAt: "asc" },
      });
    } catch {
      return [];
    }
  }
}

export async function getLatestChatUpdatesAction(currentUserId?: string, limit = 50) {
  try {
    if (!currentUserId || currentUserId === "guest") {
      return [];
    }
    await ensureDatabaseTables();

    const userChannels = await prisma.chatChannel.findMany({
      where: {
        NOT: {
          OR: [
            { id: "general" },
            { name: { equals: "general", mode: "insensitive" } },
          ],
        },
        OR: [
          { members: { has: currentUserId } },
          { admins: { has: currentUserId } },
          { createdById: currentUserId },
          { id: { contains: currentUserId } },
        ],
      },
      select: { id: true, type: true, members: true, admins: true, createdById: true },
    });

    const allowedChannelIds = userChannels
      .filter((c) => {
        if (c.type === "direct" || c.id.startsWith("dm_")) {
          return (Array.isArray(c.members) && c.members.includes(currentUserId)) || c.id.includes(currentUserId);
        }
        if (c.type === "group") {
          return (
            (Array.isArray(c.members) && c.members.includes(currentUserId)) ||
            c.createdById === currentUserId ||
            (Array.isArray(c.admins) && c.admins.includes(currentUserId))
          );
        }
        return false;
      })
      .map((c) => c.id);

    if (allowedChannelIds.length === 0) {
      return [];
    }

    const msgs = await prisma.chatMessage.findMany({
      where: {
        channelId: { in: allowedChannelIds },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return msgs.reverse();
  } catch {
    return [];
  }
}

export async function sendChatMessage(data: {
  channelId: string;
  sender: string;
  senderId?: string;
  senderImage?: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
  isForwarded?: boolean;
  replyToSender?: string;
  replyToText?: string;
}) {
  try {
    await ensureDatabaseTables();
    const newMsg = await prisma.chatMessage.create({
      data: {
        channelId: data.channelId,
        sender: data.sender,
        senderId: data.senderId || null,
        senderImage: data.senderImage || null,
        text: data.text || null,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null,
        isForwarded: data.isForwarded || false,
        replyToSender: data.replyToSender || null,
        replyToText: data.replyToText || null,
      },
    });
    return { success: true, message: newMsg };
  } catch (error: any) {
    console.warn("Gagal menyimpan chat dengan create(), mencoba self-healing tabel & retry:", error);
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderId" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "senderImage" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "text" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "fileType" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN DEFAULT false;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "isForwarded" BOOLEAN DEFAULT false;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToSender" TEXT;');
      await prisma.$executeRawUnsafe('ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "replyToText" TEXT;');

      const retryMsg = await prisma.chatMessage.create({
        data: {
          channelId: data.channelId,
          sender: data.sender,
          senderId: data.senderId || null,
          senderImage: data.senderImage || null,
          text: data.text || null,
          fileUrl: data.fileUrl || null,
          fileType: data.fileType || null,
          isForwarded: data.isForwarded || false,
          replyToSender: data.replyToSender || null,
          replyToText: data.replyToText || null,
        },
      });
      return { success: true, message: retryMsg };
    } catch (retryError: any) {
      console.warn("Retry create gagal, mencoba raw SQL fallback:", retryError);
      try {
        const id = "msg_" + Math.random().toString(36).substring(2, 11);
        await prisma.$executeRawUnsafe(
          'INSERT INTO "ChatMessage" ("id", "channelId", "sender", "senderId", "senderImage", "text", "fileUrl", "fileType", "isForwarded", "replyToSender", "replyToText", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())',
          id,
          data.channelId,
          data.sender,
          data.senderId || null,
          data.senderImage || null,
          data.text || null,
          data.fileUrl || null,
          data.fileType || null,
          data.isForwarded || false,
          data.replyToSender || null,
          data.replyToText || null
        );
        return {
          success: true,
          message: {
            id,
            channelId: data.channelId,
            sender: data.sender,
            senderId: data.senderId || null,
            senderImage: data.senderImage || null,
            text: data.text || null,
            fileUrl: data.fileUrl || null,
            fileType: data.fileType || null,
            isForwarded: data.isForwarded || false,
            replyToSender: data.replyToSender || null,
            replyToText: data.replyToText || null,
            createdAt: new Date().toISOString(),
          },
        };
      } catch (rawError: any) {
        return { success: false, error: error?.message || rawError?.message };
      }
    }
  }
}

// ==========================================
// 4. ATTENDANCE / PRESENSI ACTIONS
// ==========================================

export async function submitAttendanceAction(data: {
  userId: string;
  userName: string;
  userEmail: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  imageUrl?: string;
  location?: string;
  note?: string;
}) {
  try {
    const record = await prisma.attendance.create({
      data: {
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        type: data.type,
        imageUrl: data.imageUrl,
        location: data.location || "Office",
        note: data.note || "",
      },
    });
    revalidatePath("/admin/attendance");
    revalidatePath("/");
    return { success: true, record };
  } catch (error) {
    console.error("Gagal menyimpan presensi:", error);
    return { success: false, error: "Gagal menyimpan presensi" };
  }
}

export async function getAllAttendancesAction() {
  try {
    return await prisma.attendance.findMany({
      orderBy: { timestamp: "desc" },
    });
  } catch (error) {
    console.error("Gagal mengambil data presensi:", error);
    return [];
  }
}

export async function getTodayAttendanceStatusAction(userId: string) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todayRecords = await prisma.attendance.findMany({
      where: {
        userId: userId,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const hasClockedIn = todayRecords.some((r) => r.type === "CLOCK_IN");
    const hasClockedOut = todayRecords.some((r) => r.type === "CLOCK_OUT");

    return {
      hasClockedIn,
      hasClockedOut,
      todayRecords,
    };
  } catch (error) {
    console.error("Gagal mengecek status presensi hari ini:", error);
    return { hasClockedIn: false, hasClockedOut: false, todayRecords: [] };
  }
}

// ==========================================
// 5. CALENDAR ACTIONS
// ==========================================

export async function createCalendarEvent(data: {
  title: string;
  client: string;
  date: string;
  time: string;
  assignees: string[];
  eventType?: "online" | "offline" | string | null;
  meetLink?: string | null;
  location?: string | null;
  creatorName?: string | null;
}) {
  try {
    // Siapkan initial approval status
    const initialApprovals: Record<string, string> = {};
    if (data.creatorName) {
      initialApprovals[data.creatorName] = "accepted";
    }
    data.assignees.forEach((assignee) => {
      if (assignee !== data.creatorName && assignee !== "You") {
        initialApprovals[assignee] = "pending";
      }
    });

    const event = await prisma.calendarEvent.create({
      data: {
        id: crypto.randomUUID(),
        title: data.title,
        client: data.client,
        date: data.date,
        time: data.time,
        assignees: data.assignees,
        eventType: data.eventType || "online",
        meetLink: data.meetLink || null,
        location: data.location || null,
        creatorName: data.creatorName || null,
        approvals: initialApprovals,
      },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, event };
  } catch (error: any) {
    console.error("Gagal createCalendarEvent:", error);
    return { 
      success: false, 
      error: error?.message || "Failed to save schedule to database." 
    };
  }
}

export async function updateCalendarEvent(
  id: string,
  data: {
    title: string;
    client: string;
    date: string;
    time: string;
    assignees: string[];
    eventType?: "online" | "offline" | string | null;
    meetLink?: string | null;
    location?: string | null;
    creatorName?: string | null;
  }
) {
  try {
    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: data.title,
        client: data.client,
        date: data.date,
        time: data.time,
        assignees: data.assignees,
        eventType: data.eventType || "online",
        meetLink: data.meetLink || null,
        location: data.location || null,
        ...(data.creatorName ? { creatorName: data.creatorName } : {}),
      },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, updated };
  } catch (error: any) {
    console.error("Failed updateCalendarEvent:", error);
    return { 
      success: false, 
      error: error?.message || "Failed to update schedule in database." 
    };
  }
}

export async function respondCalendarEventApprovalAction(
  eventId: string,
  userName: string,
  status: "accepted" | "rejected"
) {
  try {
    const ev = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });
    if (!ev) return { success: false, error: "Schedule not found" };

    const currentApprovals = ((ev.approvals as Record<string, string>) || {});
    currentApprovals[userName] = status;

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { approvals: currentApprovals },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true, status };
  } catch (error: any) {
    console.error("Failed to update schedule approval:", error);
    return { success: false, error: error?.message };
  }
}

export async function getCalendarEvents() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    return events;
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return [];
  }
}

export async function deleteCalendarEvent(id: string) {
  try {
    await prisma.calendarEvent.delete({
      where: { id },
    });

    revalidatePath("/calendar");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete calendar event:", error);
    return { success: false, error: "Failed to delete schedule." };
  }
}

// ==========================================
// 6. REALTIME TASK & BRIEF ACTIONS
// ==========================================

export async function getTasksAction() {
  try {
    await ensureDatabaseTables();
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    console.error("Gagal mengambil tasks dari database:", error);
    return [];
  }
}

export async function getTaskByIdAction(id: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id },
    });
    return task;
  } catch (error) {
    console.error("Gagal mengambil task by id:", error);
    return null;
  }
}

export async function createTaskAction(data?: {
  title?: string;
  client?: string;
  type?: string;
  status?: string;
  assignee?: string;
  assignedBy?: string;
  dueDate?: string;
  brief?: string;
}) {
  try {
    await ensureDatabaseTables();
    const newTask = await prisma.task.create({
      data: {
        id: crypto.randomUUID(),
        title: data?.title?.trim() || "Untitled Task",
        client: data?.client || "General",
        type: data?.type || "Feeds",
        status: data?.status || "todo",
        assignee: data?.assignee || "Member",
        assignedBy: data?.assignedBy || null,
        dueDate: data?.dueDate || null,
        brief: data?.brief || "",
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, task: newTask };
  } catch (error: any) {
    console.error("Gagal membuat task baru:", error);
    return { success: false, error: error?.message || "Gagal membuat task." };
  }
}

export async function updateTaskStatusAction(id: string, status: string) {
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, task: updated };
  } catch (error: any) {
    console.error("Gagal update status task:", error);
    return { success: false, error: error?.message };
  }
}

export async function updateTaskAction(
  id: string,
  data: {
    title?: string;
    client?: string;
    type?: string;
    status?: string;
    assignee?: string;
    dueDate?: string;
    brief?: string;
  }
) {
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.client ? { client: data.client } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.assignee ? { assignee: data.assignee } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.brief !== undefined ? { brief: data.brief } : {}),
      },
    });

    revalidatePath("/tasks");
    return { success: true, task: updated };
  } catch (error: any) {
    console.error("Gagal update task:", error);
    return { success: false, error: error?.message };
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal delete task:", error);
    return { success: false, error: error?.message };
  }
}

// ==========================================
// 7. REALTIME NOTULEN MOM (MINUTES OF MEETING)
// ==========================================

export async function getMomNoteAction(eventId: string) {
  try {
    const note = await prisma.momNote.findUnique({
      where: { eventId },
    });
    return note;
  } catch (error) {
    console.error("Gagal mengambil notulen MoM:", error);
    return null;
  }
}

export async function saveMomNoteAction(eventId: string, content: string, title?: string) {
  try {
    const note = await prisma.momNote.upsert({
      where: { eventId },
      update: {
        content,
        ...(title ? { title } : {}),
      },
      create: {
        id: crypto.randomUUID(),
        eventId,
        title: title || "Minutes of Meeting",
        content,
      },
    });

    revalidatePath(`/mom/${eventId}`);
    return { success: true, note };
  } catch (error: any) {
    console.error("Gagal menyimpan notulen MoM:", error);
    return { success: false, error: error?.message };
  }
}

// ==========================================
// 8. CLIENT ACTIONS
// ==========================================

export async function getClientsAction() {
  try {
    let clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
    });

    // Seed default clients jika database masih kosong
    if (clients.length === 0) {
      const defaults = [
        { name: "AKASA LAND", color: "sky" },
        { name: "APERIO", color: "indigo" },
        { name: "BALI FINE GALLERY", color: "teal" },
        { name: "WEARLUCA", color: "sage" },
        { name: "General", color: "slate" },
      ];
      for (const d of defaults) {
        await prisma.client.upsert({
          where: { name: d.name },
          update: {},
          create: { id: crypto.randomUUID(), name: d.name, color: d.color },
        });
      }
      clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    }

    return clients;
  } catch (error) {
    console.error("Gagal mengambil data clients:", error);
    return [];
  }
}

export async function createClientAction(data: { name: string; color?: string }) {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) return { success: false, error: "Nama client tidak boleh kosong" };

    const client = await prisma.client.upsert({
      where: { name: trimmedName },
      update: {
        ...(data.color ? { color: data.color } : {}),
      },
      create: {
        id: crypto.randomUUID(),
        name: trimmedName,
        color: data.color || "slate",
      },
    });

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, client };
  } catch (error: any) {
    console.error("Gagal membuat/update client:", error);
    return { success: false, error: error?.message || "Gagal menyimpan client." };
  }
}

export async function updateClientAction(id: string, data: { name: string; color: string }) {
  try {
    const trimmedName = data.name.trim();
    if (!trimmedName) return { success: false, error: "Nama client tidak boleh kosong" };

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Client tidak ditemukan" };

    const oldName = existing.name;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: trimmedName,
        color: data.color,
      },
    });

    // Perbarui nama client di semua task dan jadwal kalender terkait jika nama berubah
    if (oldName !== trimmedName) {
      await prisma.task.updateMany({
        where: { client: oldName },
        data: { client: trimmedName },
      });
      await prisma.calendarEvent.updateMany({
        where: { client: oldName },
        data: { client: trimmedName },
      });
    }

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true, client: updated };
  } catch (error: any) {
    console.error("Gagal update client:", error);
    return { success: false, error: error?.message || "Gagal mengupdate client." };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await prisma.client.delete({ where: { id } });
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error: any) {
    console.error("Gagal menghapus client:", error);
    return { success: false, error: error?.message };
  }
}

export async function updateClientDescriptionAction(clientName: string, description: string) {
  try {
    const trimmed = clientName.trim();
    if (!trimmed) return { success: false, error: "Client name is required" };

    const client = await prisma.client.upsert({
      where: { name: trimmed },
      update: { description },
      create: {
        id: crypto.randomUUID(),
        name: trimmed,
        color: "slate",
        description,
      },
    });

    revalidatePath("/tasks");
    return { success: true, client };
  } catch (error: any) {
    console.error("Failed to update client description:", error);
    return { success: false, error: error?.message || "Failed to update description" };
  }
}