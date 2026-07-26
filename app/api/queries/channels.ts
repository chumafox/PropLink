import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  channelConnections,
  conversations,
  conversationParticipants,
  messages,
  users,
  type Attachment,
  type ChannelKind,
} from "@db/schema";
import { encryptToken, decryptToken } from "../channels/crypto";

// ---------- Connections ----------

export async function listConnections(userId: number) {
  return getDb()
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.userId, userId));
}

export async function addConnection(
  userId: number,
  data: {
    channel: ChannelKind;
    externalAccountId: string;
    externalAccountName?: string | null;
    accessToken?: string | null;
    verifyToken?: string | null;
    appSecret?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [{ id }] = await db
    .insert(channelConnections)
    .values({
      userId,
      channel: data.channel,
      externalAccountId: data.externalAccountId,
      externalAccountName: data.externalAccountName ?? null,
      accessTokenEnc: data.accessToken ? encryptToken(data.accessToken) : null,
      verifyToken: data.verifyToken ?? null,
      appSecretEnc: data.appSecret ? encryptToken(data.appSecret) : null,
      metadata: data.metadata ?? null,
    })
    .$returningId();
  return id;
}

export async function removeConnection(userId: number, id: number) {
  await getDb()
    .update(channelConnections)
    .set({ status: "disconnected" })
    .where(
      and(eq(channelConnections.id, id), eq(channelConnections.userId, userId)),
    );
}

export async function findConnectionByExternalId(
  channel: ChannelKind,
  externalAccountId: string,
) {
  const [row] = await getDb()
    .select()
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.channel, channel),
        eq(channelConnections.externalAccountId, externalAccountId),
        eq(channelConnections.status, "active"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findConnectionByVerifyToken(token: string) {
  const [row] = await getDb()
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.verifyToken, token))
    .limit(1);
  return row ?? null;
}

export function connectionAccessToken(
  conn: typeof channelConnections.$inferSelect,
): string | null {
  return conn.accessTokenEnc ? decryptToken(conn.accessTokenEnc) : null;
}

export function connectionAppSecret(
  conn: typeof channelConnections.$inferSelect,
): string | null {
  return conn.appSecretEnc ? decryptToken(conn.appSecretEnc) : null;
}

export async function touchConnection(id: number) {
  await getDb()
    .update(channelConnections)
    .set({ lastEventAt: new Date() })
    .where(eq(channelConnections.id, id));
}

// ---------- Shadow users (external contacts) ----------

export async function ensureShadowUser(
  channel: ChannelKind,
  externalUserId: string,
  displayName?: string | null,
) {
  const db = getDb();
  const unionId = `ext:${channel}:${externalUserId}`;
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.unionId, unionId))
    .limit(1);
  if (existing) {
    // Backfill a better name when we learn it later
    if (displayName && existing.name !== displayName) {
      await db
        .update(users)
        .set({ name: displayName })
        .where(eq(users.id, existing.id));
      return { ...existing, name: displayName };
    }
    return existing;
  }
  const [{ id }] = await db
    .insert(users)
    .values({
      unionId,
      name: displayName ?? `${channel} contact ${externalUserId}`,
      role: "user",
    })
    .$returningId();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

// ---------- Bridge external thread → conversation ----------

export async function ensureChannelConversation(
  connectionId: number,
  channel: ChannelKind,
  externalThreadId: string,
  ownerUserId: number,
  shadowUserId: number,
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.connectionId, connectionId),
        eq(conversations.externalThreadId, externalThreadId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [{ id }] = await db
    .insert(conversations)
    .values({
      channel,
      connectionId,
      externalThreadId,
      subject: `${channel} chat`,
    })
    .$returningId();
  for (const uid of [ownerUserId, shadowUserId]) {
    await db
      .insert(conversationParticipants)
      .values({ conversationId: id, userId: uid });
  }
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return row;
}

// ---------- Ingest one external message ----------

export async function ingestExternalMessage(args: {
  conversationId: number;
  senderUserId: number; // shadow user or owner (echo)
  body: string | null;
  attachments?: Attachment[];
  externalId?: string | null;
}) {
  const db = getDb();
  // Dedupe webhook redeliveries
  if (args.externalId) {
    const [dup] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalId, args.externalId))
      .limit(1);
    if (dup) return { id: dup.id, duplicate: true };
  }
  const [{ id }] = await db
    .insert(messages)
    .values({
      conversationId: args.conversationId,
      senderId: args.senderUserId,
      body: args.body,
      attachments: args.attachments ?? null,
      externalId: args.externalId ?? null,
    })
    .$returningId();
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, args.conversationId));
  return { id, duplicate: false };
}

export async function setConversationExternalEcho(
  messageExternalId: string,
  messageId: number,
) {
  await getDb()
    .update(messages)
    .set({ externalId: messageExternalId })
    .where(eq(messages.id, messageId));
}

export const _sql = sql; // keep drizzle sql import used

export async function getConnectionById(id: number) {
  const [row] = await getDb()
    .select()
    .from(channelConnections)
    .where(eq(channelConnections.id, id))
    .limit(1);
  return row ?? null;
}
