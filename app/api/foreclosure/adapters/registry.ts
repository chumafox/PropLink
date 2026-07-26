import type { CountyScraperConfig, AdapterSyncResult } from "./types";
import { scrapeCountyWithFirecrawl } from "./firecrawlAdapter";
import { scrapeRealAuctionPortal } from "./realAuctionAdapter";
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
  "broward-fl": {
    countyId: "broward-fl",
    state: "FL",
    countyName: "Broward",
    vendorPlatform: "real_auction",
    strategy: "custom_adapter",
    baseUrl: "https://broward.realforeclose.com/",
  },
  "hillsborough-fl": {
    countyId: "hillsborough-fl",
    state: "FL",
    countyName: "Hillsborough",
    vendorPlatform: "real_auction",
    strategy: "custom_adapter",
    baseUrl: "https://www.hillsclerk.com/foreclosure-sales",
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
 * Universal Multi-Strategy County Sync Executor.
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

  const lowerUrl = sourceUrl.toLowerCase();

  // 1. Specialized RealAuction / GrantStreet Auction Adapter
  if (lowerUrl.includes("realforeclose.com") || lowerUrl.includes("taxdeedauction.com")) {
    const records = await scrapeRealAuctionPortal(sourceUrl, connector.county, connector.state);
    return {
      fetched: records.length,
      valid: records.length,
      records,
      sourceUrl,
    };
  }

  // 2. Direct JSON API parsing if contentType or sourceType matches JSON API
  if (connector.sourceType === "json_api") {
    try {
      const res = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(25000),
        headers: {
          "User-Agent": "PropLink-Ingestion/1.0",
          Accept: "application/json",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const isHtmlResponse =
        contentType.includes("text/html") || contentType.includes("application/xhtml");

      if (res.ok && !isHtmlResponse) {
        const text = await res.text();
        if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
          const payload = JSON.parse(text);
          const rows = extractArray(payload);
          if (rows.length > 0) {
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
        }
      }
    } catch (err) {
      console.warn(
        `Direct JSON fetch failed for ${sourceUrl}, falling back to Firecrawl AI scraper:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 3. Fallback: Firecrawl AI Scraper Engine for HTML, PDF, ASP.NET WebForms, GovOS & Legacy Portals
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
