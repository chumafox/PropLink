import { checkUrlSSRF } from "../lib/security";
import { getDb } from "./connection";
import { webhooks, webhookDeliveries } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import crypto from "node:crypto";

export async function createWebhook(
  userId: number,
  url: string,
  events: string[],
) {
  const secret = `whsec_${crypto.randomBytes(16).toString("hex")}`;
  await getDb()
    .insert(webhooks)
    .values({ userId, url, secret, events, active: 1 });
  return { secret };
}

export async function listWebhooks(userId: number) {
  return getDb()
    .select()
    .from(webhooks)
    .where(eq(webhooks.userId, userId))
    .orderBy(desc(webhooks.createdAt));
}

export async function deleteWebhookScoped(id: number, userId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, id))
    .limit(1);
  if (!row || row.userId !== userId) return false;
  await db.delete(webhooks).where(eq(webhooks.id, id));
  return true;
}

export async function listDeliveries(webhookId: number, userId: number) {
  const db = getDb();
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);
  if (!webhook || webhook.userId !== userId) {
    return [];
  }
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(50);
}

export function signPayload(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Dispatch an event to all active webhooks of the given users
 * that subscribed to this event type. Fire-and-forget with logging.
 */
export async function dispatchWebhookEvent(
  userIds: number[],
  event: string,
  payload: unknown,
) {
  const db = getDb();
  for (const userId of [...new Set(userIds)]) {
    const hooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId));
    for (const hook of hooks) {
      if (!hook.active) continue;
      if (hook.events?.length && !hook.events.includes(event)) continue;
      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });
      void (async () => {
        let status: "success" | "failed" = "success";
        let code: number | null = null;
        try {
          await checkUrlSSRF(hook.url);
          const res = await fetch(hook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-PropLink-Event": event,
              "X-PropLink-Signature": signPayload(hook.secret, body),
            },
            body,
            signal: AbortSignal.timeout(10000),
          });
          code = res.status;
          if (!res.ok) status = "failed";
        } catch {
          status = "failed";
        }
        await db
          .insert(webhookDeliveries)
          .values({
            webhookId: hook.id,
            event,
            payload: payload as any,
            status,
            responseCode: code,
          })
          .catch(() => {});
      })();
    }
  }
}
