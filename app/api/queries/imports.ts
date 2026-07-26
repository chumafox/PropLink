import { getDb } from "./connection";
import { imports } from "@db/schema";
import { desc, eq } from "drizzle-orm";

export async function createImportRecord(
  data: Omit<typeof imports.$inferInsert, "id" | "createdAt">,
) {
  const [{ id }] = await getDb().insert(imports).values(data).$returningId();
  const [row] = await getDb()
    .select()
    .from(imports)
    .where(eq(imports.id, id))
    .limit(1);
  return row;
}

export async function findImportsByUser(userId: number) {
  return getDb()
    .select()
    .from(imports)
    .where(eq(imports.userId, userId))
    .orderBy(desc(imports.createdAt));
}
