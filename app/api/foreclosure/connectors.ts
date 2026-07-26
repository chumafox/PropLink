import type { ForeclosureRecordType } from "@db/schema";

/**
 * County connector abstraction.
 *
 * Each US county publishes foreclosure / pre-foreclosure records in its own
 * format (HTML tables, PDFs, legacy ASP apps, JSON APIs). A connector knows
 * how to fetch and normalize one county's records into the common shape.
 *
 * Real adapters plug into your scraping stack (curl_cffi + WARP egress on
 * Render) — the interface stays the same, only fetch() changes.
 */
export interface RawForeclosureRecord {
  county: string;
  state: string;
  recordType: ForeclosureRecordType;
  caseNumber?: string;
  sourceUrl?: string;
  addressLine1: string;
  city: string;
  zip?: string;
  ownerName?: string;
  estimatedValue?: number;
  openingBid?: number;
  auctionDate?: string;
  filingDate?: string;
  lat?: number;
  lng?: number;
  raw?: Record<string, unknown>;
}

export interface CountyConnector {
  /** e.g. "maricopa-az" */
  id: string;
  county: string;
  state: string;
  /** Human description of the source endpoint */
  sourceDescription: string;
  fetch(): Promise<RawForeclosureRecord[]>;
}

// ---------------------------------------------------------------------------
// Demo connectors — deterministic sample data, same interface as real ones.
// Replace fetch() with actual scraping when credentials/proxy are ready.
// ---------------------------------------------------------------------------

const maricopaSample: RawForeclosureRecord[] = [];
const harrisSample: RawForeclosureRecord[] = [];
const hillsboroughSample: RawForeclosureRecord[] = [];

function demoConnector(
  id: string,
  county: string,
  state: string,
  sourceDescription: string,
  records: RawForeclosureRecord[],
): CountyConnector {
  return {
    id,
    county,
    state,
    sourceDescription,
    fetch: async () => records,
  };
}

export const connectors: CountyConnector[] = [
  demoConnector(
    "maricopa-az",
    "Maricopa",
    "AZ",
    "Maricopa County Recorder — trustee sale & lis pendens filings",
    maricopaSample,
  ),
  demoConnector(
    "harris-tx",
    "Harris",
    "TX",
    "Harris County Clerk — foreclosure postings (1st Tuesday auctions)",
    harrisSample,
  ),
  demoConnector(
    "hillsborough-fl",
    "Hillsborough",
    "FL",
    "Hillsborough County Clerk — foreclosure sales calendar",
    hillsboroughSample,
  ),
];

export function getConnector(id: string) {
  return connectors.find((c) => c.id === id) ?? null;
}
