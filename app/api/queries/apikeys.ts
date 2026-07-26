import { getDb } from "./connection";
import { apiKeys } from "@db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import crypto from "node:crypto";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createApiKey(userId: number, name: string) {
  const token = `plk_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = token.slice(0, 12);
  const db = getDb();
  await db.insert(apiKeys).values({
    userId,
    name,
    prefix,
    keyHash: hashToken(token),
    scopes: ["listings:read", "listings:write", "offers:read", "offers:write"],
  });
  return { token, prefix };
}

export async function listApiKeys(userId: number) {
  return getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: number, userId: number) {
  await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

export async function findKeyByToken(token: string) {
  const [row] = await getDb()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashToken(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  return row ?? null;
}

export async function touchKey(id: number) {
  await getDb()
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}
