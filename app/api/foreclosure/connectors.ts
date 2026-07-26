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

const maricopaSample: RawForeclosureRecord[] = [
  {
    county: "Maricopa",
    state: "AZ",
    recordType: "notice_of_sale",
    caseNumber: "FC2026-04117",
    sourceUrl: "https://recorder.maricopa.gov/",
    addressLine1: "8821 N 35th Ave",
    city: "Phoenix",
    zip: "85051",
    ownerName: "R. Delgado",
    estimatedValue: 385000,
    openingBid: 264000,
    auctionDate: "2026-08-14",
    filingDate: "2026-07-02",
    lat: 33.566,
    lng: -112.132,
  },
  {
    county: "Maricopa",
    state: "AZ",
    recordType: "lis_pendens",
    caseNumber: "CV2026-052310",
    sourceUrl: "https://recorder.maricopa.gov/",
    addressLine1: "1402 W Encanto Blvd",
    city: "Phoenix",
    zip: "85007",
    ownerName: "T. Nguyen",
    estimatedValue: 452000,
    filingDate: "2026-07-18",
    lat: 33.471,
    lng: -112.091,
  },
  {
    county: "Maricopa",
    state: "AZ",
    recordType: "notice_of_default",
    caseNumber: "FC2026-04388",
    sourceUrl: "https://recorder.maricopa.gov/",
    addressLine1: "7740 E McKellips Rd #12",
    city: "Scottsdale",
    zip: "85257",
    ownerName: "M. Osei",
    estimatedValue: 398000,
    filingDate: "2026-07-15",
    lat: 33.469,
    lng: -111.915,
  },
];

const harrisSample: RawForeclosureRecord[] = [
  {
    county: "Harris",
    state: "TX",
    recordType: "auction",
    caseNumber: "2026-44712",
    sourceUrl: "https://www.cclerk.hctx.net/",
    addressLine1: "12026 Pine Falls Dr",
    city: "Houston",
    zip: "77065",
    ownerName: "J. Whitfield",
    estimatedValue: 310000,
    openingBid: 198500,
    auctionDate: "2026-08-04",
    filingDate: "2026-06-28",
    lat: 29.895,
    lng: -95.587,
  },
  {
    county: "Harris",
    state: "TX",
    recordType: "lis_pendens",
    caseNumber: "2026-46091",
    sourceUrl: "https://www.cclerk.hctx.net/",
    addressLine1: "7710 S Gessner Rd",
    city: "Houston",
    zip: "77036",
    ownerName: "A. Fernandez",
    estimatedValue: 265000,
    filingDate: "2026-07-20",
    lat: 29.696,
    lng: -95.528,
  },
];

const hillsboroughSample: RawForeclosureRecord[] = [
  {
    county: "Hillsborough",
    state: "FL",
    recordType: "notice_of_default",
    caseNumber: "26-CA-007712",
    sourceUrl: "https://www.hillsclerk.com/",
    addressLine1: "5403 E Sligh Ave",
    city: "Tampa",
    zip: "33617",
    ownerName: "D. Petrov",
    estimatedValue: 342000,
    filingDate: "2026-07-21",
    lat: 28.012,
    lng: -82.397,
  },
  {
    county: "Hillsborough",
    state: "FL",
    recordType: "auction",
    caseNumber: "26-CA-006845",
    sourceUrl: "https://www.hillsclerk.com/",
    addressLine1: "11415 Misty Isle Ln",
    city: "Riverview",
    zip: "33579",
    ownerName: "K. Sanders",
    estimatedValue: 428000,
    openingBid: 289000,
    auctionDate: "2026-08-11",
    filingDate: "2026-06-30",
    lat: 27.828,
    lng: -82.303,
  },
];

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
