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
import {
  getCountyListForState,
  crawlAndSaveSingleCounty,
} from "./lib/netrCrawler";
import { executeCountySyncAdapter } from "./foreclosure/adapters/registry";

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
    return custom;
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
  // Supports direct JSON APIs, built-in demos, and HTML/PDF/SPA county portals via Firecrawl Scraper Engine.
  sync: authedQuery
    .input(z.object({ connectorId: z.string() }))
    .mutation(async ({ input }) => {
      // Custom DB connector
      if (input.connectorId.startsWith("db-")) {
        const dbId = Number(input.connectorId.slice(3));
        const conn = await getCountyConnector(dbId);
        if (!conn || !conn.active) throw new TRPCError({ code: "NOT_FOUND" });

        try {
          const syncResult = await executeCountySyncAdapter(conn);
          const inserted = await insertNormalized(syncResult.records);
          await markConnectorSynced(dbId);
          return {
            fetched: syncResult.fetched,
            valid: syncResult.valid,
            inserted,
          };
        } catch (e: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e.message || "Failed to sync county source",
          });
        }
      }

      // Built-in demo connector
      const connector = getConnector(input.connectorId);
      if (!connector) throw new TRPCError({ code: "NOT_FOUND" });
      const records = await connector.fetch();
      const inserted = await insertNormalized(records);
      return { fetched: records.length, valid: records.length, inserted };
    }),

  getNetrCounties: authedQuery
    .input(z.object({ state: z.string().length(2) }))
    .query(async ({ input }) => {
      try {
        return await getCountyListForState(input.state);
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message || "Failed to fetch county list from NETR Online",
        });
      }
    }),

  crawlNetrCounty: authedQuery
    .input(z.object({ countyUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await crawlAndSaveSingleCounty(input.countyUrl, ctx.user.id);
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message || "Failed to crawl selected county from NETR Online",
        });
      }
    }),

  getCountyDirectory: authedQuery
    .input(z.object({ state: z.string().length(2) }))
    .query(async ({ input }) => {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const dirPath = path.resolve(process.cwd(), "db/county_directory.json");
        if (fs.existsSync(dirPath)) {
          const content = JSON.parse(fs.readFileSync(dirPath, "utf-8"));
          const counties = content.counties?.[input.state.toUpperCase()];
          if (counties) return counties;
        }
        // Fallback to NETR crawler list
        return await getCountyListForState(input.state);
      } catch (err) {
        return await getCountyListForState(input.state);
      }
    }),
});
