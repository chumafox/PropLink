import { getDb } from "./connection";
import { countyConnectors } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function listCountyConnectors() {
  return getDb()
    .select()
    .from(countyConnectors)
    .where(eq(countyConnectors.active, 1))
    .orderBy(desc(countyConnectors.createdAt));
}

export async function addCountyConnector(
  userId: number,
  data: {
    county: string;
    state: string;
    sourceUrl?: string;
    sourceType: "json_api" | "html" | "pdf" | "spa";
    notes?: string;
  },
) {
  const [{ id }] = await getDb()
    .insert(countyConnectors)
    .values({
      userId,
      county: data.county,
      state: data.state,
      sourceUrl: data.sourceUrl ?? null,
      sourceType: data.sourceType,
      notes: data.notes ?? null,
    })
    .$returningId();
  return id;
}

export async function removeCountyConnector(id: number, userId: number) {
  await getDb()
    .update(countyConnectors)
    .set({ active: 0 })
    .where(
      and(eq(countyConnectors.id, id), eq(countyConnectors.userId, userId)),
    );
}

export async function markConnectorSynced(id: number) {
  await getDb()
    .update(countyConnectors)
    .set({ lastSyncAt: new Date() })
    .where(eq(countyConnectors.id, id));
}

export async function getCountyConnector(id: number) {
  const [row] = await getDb()
    .select()
    .from(countyConnectors)
    .where(eq(countyConnectors.id, id))
    .limit(1);
  return row ?? null;
}
