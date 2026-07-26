import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { aiSettings, messages, type AiProvider } from "@db/schema";
import { decryptToken, encryptToken } from "../channels/crypto";

function decryptKey(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith("v1.")) return stored; // legacy plaintext row
  return decryptToken(stored);
}

export async function getAiSettings(userId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.userId, userId))
    .limit(1);
  if (!row) return null;
  return { ...row, apiKey: decryptKey(row.apiKey) };
}

export async function upsertAiSettings(
  userId: number,
  data: {
    provider: AiProvider;
    apiKey?: string | null;
    baseUrl?: string | null;
    model?: string | null;
    targetLanguage?: string;
    autoTranslate?: boolean;
  },
) {
  const db = getDb();
  const encKey =
    data.apiKey === undefined
      ? undefined
      : data.apiKey === null
        ? null
        : encryptToken(data.apiKey);
  const set: Record<string, unknown> = {
    provider: data.provider,
    baseUrl: data.baseUrl ?? null,
    model: data.model ?? null,
    targetLanguage: data.targetLanguage ?? "en",
    autoTranslate: data.autoTranslate ? 1 : 0,
  };
  // Only overwrite the key when a new one is supplied; undefined = keep old.
  if (encKey !== undefined) set.apiKey = encKey;
  await db
    .insert(aiSettings)
    .values({
      userId,
      provider: data.provider,
      apiKey: encKey ?? null,
      baseUrl: data.baseUrl ?? null,
      model: data.model ?? null,
      targetLanguage: data.targetLanguage ?? "en",
      autoTranslate: data.autoTranslate ? 1 : 0,
    })
    .onDuplicateKeyUpdate({ set });
}

export async function deleteAiSettings(userId: number) {
  await getDb().delete(aiSettings).where(eq(aiSettings.userId, userId));
}

// Cache a translation on the message row (JSON merge).
export async function cacheMessageTranslation(
  messageId: number,
  lang: string,
  translated: string,
) {
  const db = getDb();
  await db
    .update(messages)
    .set({
      translations: sql`JSON_SET(COALESCE(${messages.translations}, JSON_OBJECT()), ${"$." + lang}, ${translated})` as any,
    })
    .where(eq(messages.id, messageId));
}
