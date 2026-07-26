import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  searchForeclosures,
  insertForeclosureRecord,
  foreclosureStats,
} from "./queries/foreclosures";
import {
  listCountyConnectors,
  addCountyConnector,
  removeCountyConnector,
  markConnectorSynced,
  getCountyConnector,
} from "./queries/countyConnectors";
import { connectors, getConnector } from "./foreclosure/connectors";
import { extractArray, normalizeRow } from "./foreclosure/normalize";
import { foreclosureRecordTypes } from "@db/schema";

async function insertNormalized(records: ReturnType<typeof normalizeRow>[]) {
  let inserted = 0;
  for (const r of records) {
    if (!r) continue;
    const res = await insertForeclosureRecord({
      ...r,
      caseNumber: r.caseNumber ?? null,
      sourceUrl: r.sourceUrl ?? null,
      zip: r.zip ?? null,
      ownerName: r.ownerName ?? null,
      estimatedValue: r.estimatedValue ?? null,
      openingBid: r.openingBid ?? null,
      auctionDate: r.auctionDate ?? null,
      filingDate: r.filingDate ?? null,
      lat: r.lat ?? null,
      lng: r.lng ?? null,
      raw: r.raw ?? null,
    });
    if (res.inserted) inserted++;
  }
  return inserted;
}

export const foreclosuresRouter = createRouter({
  search: authedQuery
    .input(
      z
        .object({
          county: z.string().max(128).optional(),
          state: z.string().max(64).optional(),
          recordType: z.enum(foreclosureRecordTypes).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(({ input }) => searchForeclosures(input ?? {})),

  stats: authedQuery.query(() => foreclosureStats()),

  connectors: authedQuery.query(async () => {
    const builtIns = connectors.map((c) => ({
      id: c.id,
      county: c.county,
      state: c.state,
      sourceDescription: c.sourceDescription,
      sourceType: "demo" as const,
      isCustom: false,
      ownerId: null as number | null,
      lastSyncAt: null as Date | null,
    }));
    const custom = (await listCountyConnectors()).map((c) => ({
      id: `db-${c.id}`,
      county: c.county,
      state: c.state,
      sourceDescription:
        c.sourceUrl ?? c.notes ?? "Custom county source",
      sourceType: c.sourceType as "json_api" | "html" | "pdf",
      isCustom: true,
      ownerId: c.userId,
      lastSyncAt: c.lastSyncAt,
    }));
    return [...custom, ...builtIns];
  }),

  addConnector: authedQuery
    .input(
      z.object({
        county: z.string().min(1).max(128),
        state: z.string().min(1).max(64),
        sourceUrl: z.string().url().optional().or(z.literal("")),
        sourceType: z.enum(["json_api", "html", "pdf"]).default("json_api"),
        notes: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await addCountyConnector(ctx.user.id, {
        ...input,
        sourceUrl: input.sourceUrl || undefined,
      });
      return { id };
    }),

  removeConnector: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await removeCountyConnector(input.id, ctx.user.id);
      return { ok: true };
    }),

  // Pull fresh records from a connector into the database.
  // Built-in demos → sample data; custom json_api → real fetch + normalize;
  // html/pdf → needs a custom scraper adapter (rejected with a clear error).
  sync: authedQuery
    .input(z.object({ connectorId: z.string() }))
    .mutation(async ({ input }) => {
      // Custom DB connector
      if (input.connectorId.startsWith("db-")) {
        const dbId = Number(input.connectorId.slice(3));
        const conn = await getCountyConnector(dbId);
        if (!conn || !conn.active) throw new TRPCError({ code: "NOT_FOUND" });
        if (conn.sourceType !== "json_api") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This source type needs a custom scraper adapter (HTML/PDF parsing). json_api sources sync automatically.",
          });
        }
        if (!conn.sourceUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Connector has no source URL",
          });
        }
        let payload: unknown;
        try {
          const res = await fetch(conn.sourceUrl, {
            signal: AbortSignal.timeout(20000),
            headers: { "User-Agent": "PropLink-Ingestion/1.0" },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          payload = await res.json();
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Fetch failed: ${e instanceof Error ? e.message : "unknown"}`,
          });
        }
        const rows = extractArray(payload);
        if (rows.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "No records array found in the JSON response (looked for data/records/results/items)",
          });
        }
        const normalized = rows.map((r) =>
          normalizeRow(r, {
            county: conn.county,
            state: conn.state,
            sourceUrl: conn.sourceUrl ?? undefined,
          }),
        );
        const valid = normalized.filter(Boolean);
        const inserted = await insertNormalized(valid);
        await markConnectorSynced(dbId);
        return {
          fetched: rows.length,
          valid: valid.length,
          inserted,
        };
      }

      // Built-in demo connector
      const connector = getConnector(input.connectorId);
      if (!connector) throw new TRPCError({ code: "NOT_FOUND" });
      const records = await connector.fetch();
      const inserted = await insertNormalized(records);
      return { fetched: records.length, valid: records.length, inserted };
    }),
});
