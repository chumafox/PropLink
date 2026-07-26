import type { CountyScraperConfig, AdapterSyncResult } from "./types";
import { scrapeCountyWithFirecrawl } from "./firecrawlAdapter";
import { extractArray, normalizeRow } from "../normalize";
import type { RawForeclosureRecord } from "../connectors";

export const COUNTY_CONFIGS: Record<string, CountyScraperConfig> = {
  "alachua-fl": {
    countyId: "alachua-fl",
    state: "FL",
    countyName: "Alachua",
    vendorPlatform: "aspnet_webforms",
    strategy: "firecrawl_ai",
    baseUrl:
      "https://www.alachuacounty.us/depts/clerk/publicrecords/pages/officialrecords.aspx",
    disclaimerRequired: true,
  },
  "hillsborough-fl": {
    countyId: "hillsborough-fl",
    state: "FL",
    countyName: "Hillsborough",
    vendorPlatform: "direct_api",
    strategy: "direct_api",
    baseUrl: "https://www.hillsclerk.com/",
  },
  "maricopa-az": {
    countyId: "maricopa-az",
    state: "AZ",
    countyName: "Maricopa",
    vendorPlatform: "direct_api",
    strategy: "direct_api",
    baseUrl: "https://recorder.maricopa.gov/",
  },
  "harris-tx": {
    countyId: "harris-tx",
    state: "TX",
    countyName: "Harris",
    vendorPlatform: "direct_api",
    strategy: "direct_api",
    baseUrl: "https://www.cclerk.hctx.net/",
  },
};

/**
 * Universal County Sync Executor.
 * Routes execution based on source type and vendor configs:
 * - json_api: Direct fetch + JSON mapping.
 * - html / pdf / custom: Uses Firecrawl AI Scraper Adapter or vendor strategy.
 */
export async function executeCountySyncAdapter(connector: {
  id: number;
  county: string;
  state: string;
  sourceUrl: string | null;
  sourceType: string;
  notes: string | null;
}): Promise<AdapterSyncResult> {
  const sourceUrl = connector.sourceUrl;
  if (!sourceUrl) {
    throw new Error("Connector has no source URL configured.");
  }

  // 1. Check if connector matches a JSON API source
  if (connector.sourceType === "json_api") {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(25000),
      headers: { "User-Agent": "PropLink-Ingestion/1.0" },
    });
    if (!res.ok) {
      throw new Error(`Direct JSON API fetch failed: HTTP ${res.status}`);
    }

    const payload = await res.json();
    const rows = extractArray(payload);
    if (rows.length === 0) {
      throw new Error(
        "No records array found in JSON response (expected data, records, results, or items).",
      );
    }

    const normalized = rows
      .map((r) =>
        normalizeRow(r, {
          county: connector.county,
          state: connector.state,
          sourceUrl,
        }),
      )
      .filter((r): r is RawForeclosureRecord => r !== null);

    return {
      fetched: rows.length,
      valid: normalized.length,
      records: normalized,
      sourceUrl,
    };
  }

  // 2. HTML / PDF / ASP.NET WebForms / Legacy Portals -> Use Firecrawl Scraper Engine
  const records = await scrapeCountyWithFirecrawl(
    sourceUrl,
    connector.county,
    connector.state,
  );

  return {
    fetched: records.length,
    valid: records.length,
    records,
    sourceUrl,
  };
}
