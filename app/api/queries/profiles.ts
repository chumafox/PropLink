import { getDb } from "./connection";
import { profiles, type ProRole } from "@db/schema";
import { eq } from "drizzle-orm";

export async function findProfileByUserId(userId: number) {
  const [row] = await getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertProfile(
  userId: number,
  data: {
    proRole: ProRole;
    company?: string;
    phone?: string;
    licenseNumber?: string;
    bio?: string;
    marketsServed?: string;
    onboarded?: number;
  },
) {
  await getDb()
    .insert(profiles)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { ...data } });
  return findProfileByUserId(userId);
}
