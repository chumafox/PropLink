import { getDb } from "./connection";
import { foreclosureRecords } from "@db/schema";
import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";

export type ForeclosureSearchInput = {
  county?: string;
  state?: string;
  recordType?: string;
  limit?: number;
  offset?: number;
};

export async function purgeOutdatedForeclosures() {
  const db = getDb();
  // Delete records where auctionDate or filingDate has a past year (2020-2025) OR matches known demo/mock records
  await db
    .delete(foreclosureRecords)
    .where(
      sql`${foreclosureRecords.auctionDate} LIKE '%2023%' OR ${foreclosureRecords.auctionDate} LIKE '%2024%' OR ${foreclosureRecords.auctionDate} LIKE '%2025%' OR ${foreclosureRecords.filingDate} LIKE '%2023%' OR ${foreclosureRecords.filingDate} LIKE '%2024%' OR ${foreclosureRecords.filingDate} LIKE '%2025%' OR ${foreclosureRecords.caseNumber} IN ('26-CA-007712', '26-CA-006845', '2026-44712', '2026-46091', 'FC2026-04117', 'CV2026-052310', 'FC2026-04388') OR ${foreclosureRecords.addressLine1} LIKE '%Sligh Ave%' OR ${foreclosureRecords.addressLine1} LIKE '%Misty Isle%' OR ${foreclosureRecords.addressLine1} LIKE '%Pine Falls%' OR ${foreclosureRecords.addressLine1} LIKE '%Gessner Rd%' OR ${foreclosureRecords.addressLine1} LIKE '%35th Ave%' OR ${foreclosureRecords.addressLine1} LIKE '%Encanto%' OR ${foreclosureRecords.addressLine1} LIKE '%McKellips%'`,
    );
}

export async function searchForeclosures(input: ForeclosureSearchInput) {
  const db = getDb();
  await purgeOutdatedForeclosures();

  const conds: SQL[] = [];
  if (input.county) conds.push(like(foreclosureRecords.county, `%${input.county}%`));
  if (input.state) conds.push(eq(foreclosureRecords.state, input.state));
  if (input.recordType)
    conds.push(eq(foreclosureRecords.recordType, input.recordType as any));

  const where = conds.length ? and(...conds) : undefined;
  const items = await db
    .select()
    .from(foreclosureRecords)
    .where(where)
    .orderBy(desc(foreclosureRecords.createdAt))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(foreclosureRecords)
    .where(where);
  return { items, total: Number(count) };
}

export async function insertForeclosureRecord(
  data: Omit<typeof foreclosureRecords.$inferInsert, "id" | "createdAt">,
) {
  // dedupe by caseNumber when present
  if (data.caseNumber) {
    const [existing] = await getDb()
      .select({ id: foreclosureRecords.id })
      .from(foreclosureRecords)
      .where(eq(foreclosureRecords.caseNumber, data.caseNumber))
      .limit(1);
    if (existing) return { id: existing.id, inserted: false };
  }
  const [{ id }] = await getDb()
    .insert(foreclosureRecords)
    .values(data)
    .$returningId();
  return { id, inserted: true };
}

export async function foreclosureStats() {
  const db = getDb();
  const byCounty = await db
    .select({
      county: foreclosureRecords.county,
      state: foreclosureRecords.state,
      count: sql<number>`count(*)`,
    })
    .from(foreclosureRecords)
    .groupBy(foreclosureRecords.county, foreclosureRecords.state)
    .orderBy(desc(sql`count(*)`))
    .limit(20);
  return byCounty;
}
