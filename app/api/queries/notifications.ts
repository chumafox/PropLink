import { getDb } from "./connection";
import { notifications } from "@db/schema";
import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";

export async function createNotification(
  userId: number,
  data: { type: string; title: string; body?: string; link?: string },
) {
  await getDb()
    .insert(notifications)
    .values({
      userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
    });
}

export async function listNotifications(userId: number, limit = 30) {
  return getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadNotificationCount(userId: number) {
  const [{ count }] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(count);
}

export async function markAllRead(userId: number) {
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function clearReadNotifications(userId: number) {
  await getDb()
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), isNotNull(notifications.readAt)));
}
