import { getDb } from "./connection";
import {
  conversations,
  conversationParticipants,
  conversationTasks,
  messages,
  listings,
  users,
  hiddenMessages,
  notifications,
  type Attachment,
  type ConversationTaskStatus,
} from "@db/schema";
import { and, desc, eq, gt, ne, sql, inArray, asc } from "drizzle-orm";
import { resolveFileUrl } from "../uploads";

export async function isParticipant(conversationId: number, userId: number) {
  const [row] = await getDb()
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function listConversationsForUser(userId: number) {
  const db = getDb();
  const myConvs = await db
    .select({
      conversation: conversations,
      participant: conversationParticipants,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversationParticipants.conversationId, conversations.id),
    )
    .where(eq(conversationParticipants.userId, userId));

  myConvs.sort((a, b) => {
    // 1. Pinned conversations first
    if (a.participant.isPinned !== b.participant.isPinned) {
      return (b.participant.isPinned || 0) - (a.participant.isPinned || 0);
    }
    // 2. If both are pinned, sort by their user-defined sort order
    if (a.participant.isPinned) {
      const orderA = a.participant.sortOrder || 0;
      const orderB = b.participant.sortOrder || 0;
      if (orderA !== orderB) return orderA - orderB;
    }
    // 3. Fallback to latest message
    const aTime = a.conversation.lastMessageAt?.getTime() ?? 0;
    const bTime = b.conversation.lastMessageAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const result = [];
  for (const { conversation, participant } of myConvs) {
    const others = await db
      .select({ name: users.name, avatar: users.avatar, id: users.id })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(
        and(
          eq(conversationParticipants.conversationId, conversation.id),
          ne(conversationParticipants.userId, userId),
        ),
      );

    const [lastMsg] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversation.id),
          ne(messages.senderId, userId),
          participant.lastReadAt
            ? gt(messages.createdAt, participant.lastReadAt)
            : sql`1=1`,
        ),
      );

    let listingTitle: string | null = null;
    let relatedListings: Array<{ id: number; title: string | null }> = [];

    if (conversation.listingId) {
      const [l] = await db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(eq(listings.id, conversation.listingId))
        .limit(1);
      if (l) {
        listingTitle = l.title;
        relatedListings.push(l);
      }
    } else if (conversation.isGroup === 1 && others.length > 0) {
      const participantIds = others.map(u => u.id);
      relatedListings = await db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(inArray(listings.ownerId, participantIds))
        .limit(5);
    }

    if (Array.isArray(conversation.pinnedFiles) && conversation.pinnedFiles.length > 0) {
      conversation.pinnedFiles = await Promise.all(
        conversation.pinnedFiles.map(async (f) => ({
          ...f,
          url: await resolveFileUrl(f.url),
        }))
      );
    }

    result.push({
      conversation,
      participant,
      otherUser: others[0] ?? null,
      otherUsers: others,
      lastMessage: lastMsg ?? null,
      unreadCount: Number(count),
      listingTitle,
      relatedListings,
    });
  }
  return result;
}

export async function findDirectConversation(
  userId: number,
  otherUserId: number,
  listingId?: number,
) {
  const db = getDb();
  const myConvs = await db
    .select({ conversation: conversations })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversationParticipants.conversationId, conversations.id),
    )
    .where(eq(conversationParticipants.userId, userId));

  for (const { conversation } of myConvs) {
    if ((conversation.listingId ?? null) !== (listingId ?? null)) continue;
    if (conversation.offerId) continue;
    if (await isParticipant(conversation.id, otherUserId)) return conversation;
  }
  return null;
}

export async function createConversation(
  participantIds: number[],
  opts: { listingId?: number; offerId?: number; subject?: string; isGroup?: boolean } = {},
) {
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(conversations)
      .values({
        listingId: opts.listingId ?? null,
        offerId: opts.offerId ?? null,
        subject: opts.subject ?? null,
        isGroup: opts.isGroup ? 1 : 0,
      })
      .$returningId();
    for (const uid of participantIds) {
      await tx
        .insert(conversationParticipants)
        .values({ conversationId: id, userId: uid });
    }
    const [row] = await tx
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return row;
  });
}

export async function getChatContacts(userId: number) {
  const db = getDb();
  const myConvs = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  const convIds = myConvs.map(c => c.conversationId);
  if (convIds.length === 0) return [];

  const allOthers = await db
    .select({ id: users.id, name: users.name, avatar: users.avatar })
    .from(conversationParticipants)
    .innerJoin(users, eq(conversationParticipants.userId, users.id))
    .where(
      and(
        inArray(conversationParticipants.conversationId, convIds),
        ne(conversationParticipants.userId, userId),
      )
    );

  const seen = new Set<number>();
  const contacts: Array<{ id: number; name: string; avatar: string | null }> = [];
  for (const user of allOthers) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      contacts.push({ id: user.id, name: user.name || "Unknown", avatar: user.avatar });
    }
  }
  return contacts;
}

export async function getMessages(conversationId: number, userId: number) {
  const rows = await getDb()
    .select({
      message: messages,
      senderName: users.name,
      senderAvatar: users.avatar,
      isHidden: sql<boolean>`${hiddenMessages.id} IS NOT NULL`,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .leftJoin(
      hiddenMessages,
      and(
        eq(hiddenMessages.messageId, messages.id),
        eq(hiddenMessages.userId, userId)
      )
    )
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(500);
  // Resolve private s3:// attachments into fresh presigned GET URLs
  for (const row of rows) {
    const atts = row.message.attachments;
    if (atts?.length) {
      row.message.attachments = await Promise.all(
        atts.map(async (a) =>
          a.url.startsWith("s3://")
            ? { ...a, url: await resolveFileUrl(a.url) }
            : a,
        ),
      );
    }
  }
  return rows;
}

export async function sendMessage(
  conversationId: number,
  senderId: number,
  body: string | null,
  attachments: Attachment[],
) {
  const db = getDb();
  return await db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(messages)
      .values({ conversationId, senderId, body, attachments })
      .$returningId();
    await tx
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    const [row] = await tx
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    return row;
  });
}

export async function markRead(conversationId: number, userId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId),
        ),
      );

    await tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.link, `/messages/${conversationId}`),
          sql`${notifications.readAt} IS NULL`
        )
      );
  });
}

export async function totalUnread(userId: number) {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(
      conversationParticipants,
      and(
        eq(messages.conversationId, conversationParticipants.conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .where(
      and(
        ne(messages.senderId, userId),
        sql`${messages.createdAt} > COALESCE(${conversationParticipants.lastReadAt}, '1970-01-01')`,
      ),
    );
  return Number(count);
}

export async function getOtherParticipantIds(
  conversationId: number,
  senderId: number,
) {
  const rows = await getDb()
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        ne(conversationParticipants.userId, senderId),
      ),
    );
  return rows.map((r) => r.userId);
}

export async function getMessageById(id: number) {
  const [row] = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);
  return row ?? null;
}

export async function getConversationById(id: number) {
  const [row] = await getDb()
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return row ?? null;
}

export async function hideMessage(messageId: number, userId: number) {
  const db = getDb();
  await db
    .insert(hiddenMessages)
    .values({ messageId, userId })
    // If it already exists, just ignore it (MySQL ON DUPLICATE KEY UPDATE id=id)
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
}

export async function unhideMessage(messageId: number, userId: number) {
  const db = getDb();
  await db
    .delete(hiddenMessages)
    .where(and(eq(hiddenMessages.messageId, messageId), eq(hiddenMessages.userId, userId)));
}

export async function setConversationListing(conversationId: number, listingId: number) {
  const db = getDb();
  await db
    .update(conversations)
    .set({ listingId })
    .where(eq(conversations.id, conversationId));
}

export async function setConversationPinnedFiles(conversationId: number, pinnedFiles: Attachment[]) {
  const db = getDb();
  await db
    .update(conversations)
    .set({ pinnedFiles })
    .where(eq(conversations.id, conversationId));
}

export async function setConversationNotes(conversationId: number, userId: number, notes: string) {
  const db = getDb();
  await db
    .update(conversationParticipants)
    .set({ notes })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

export async function getConversationTasks(conversationId: number) {
  const db = getDb();
  return db
    .select()
    .from(conversationTasks)
    .where(eq(conversationTasks.conversationId, conversationId))
    .orderBy(asc(conversationTasks.position), asc(conversationTasks.createdAt));
}

export async function createConversationTask(conversationId: number, title: string) {
  const db = getDb();
  const [{ id }] = await db
    .insert(conversationTasks)
    .values({ conversationId, title })
    .$returningId();
  const [row] = await db
    .select()
    .from(conversationTasks)
    .where(eq(conversationTasks.id, id))
    .limit(1);
  return row;
}

export async function updateConversationTaskStatus(conversationId: number, taskId: number, status: ConversationTaskStatus) {
  const db = getDb();
  await db
    .update(conversationTasks)
    .set({ status })
    .where(
      and(
        eq(conversationTasks.id, taskId),
        eq(conversationTasks.conversationId, conversationId),
      ),
    );
}

export async function deleteConversationTask(conversationId: number, taskId: number) {
  const db = getDb();
  await db
    .delete(conversationTasks)
    .where(
      and(
        eq(conversationTasks.id, taskId),
        eq(conversationTasks.conversationId, conversationId),
      ),
    );
}

export async function toggleConversationPin(conversationId: number, userId: number, isPinned: number) {
  await getDb()
    .update(conversationParticipants)
    .set({ isPinned })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    );
}

export async function reorderConversations(conversationIds: number[], userId: number) {
  const db = getDb();
  for (let i = 0; i < conversationIds.length; i++) {
    await db
      .update(conversationParticipants)
      .set({ sortOrder: i })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationIds[i]),
          eq(conversationParticipants.userId, userId)
        )
      );
  }
}


export async function reorderConversationTasks(conversationId: number, taskIds: number[]) {
  const db = getDb();
  // Simple reorder: update position for each given taskId
  for (let i = 0; i < taskIds.length; i++) {
    await db
      .update(conversationTasks)
      .set({ position: i })
      .where(
        and(
          eq(conversationTasks.id, taskIds[i]),
          eq(conversationTasks.conversationId, conversationId)
        )
      );
  }
}
