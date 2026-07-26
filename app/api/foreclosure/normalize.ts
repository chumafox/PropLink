import type { RawForeclosureRecord } from "./connectors";
import type { ForeclosureRecordType } from "@db/schema";

/**
 * Flexible normalizer for county JSON APIs: accepts an array of records
 * (or { data | records | results | items }) and maps common field name
 * variants into the canonical RawForeclosureRecord shape.
 */

const RECORD_TYPE_MAP: Record<string, ForeclosureRecordType> = {
  lis_pendens: "lis_pendens",
  lispendens: "lis_pendens",
  lp: "lis_pendens",
  foreclosure_complaint: "lis_pendens",
  lis_pendens_foreclosure: "lis_pendens",
  notice_of_default: "notice_of_default",
  nod: "notice_of_default",
  default: "notice_of_default",
  notice_of_sale: "notice_of_sale",
  nos: "notice_of_sale",
  sale: "notice_of_sale",
  trustee_sale: "notice_of_sale",
  notice_of_trustee_sale: "notice_of_sale",
  notice_of_trustees_sale: "notice_of_sale",
  nts: "notice_of_sale",
  notice_of_foreclosure_sale: "notice_of_sale",
  auction: "auction",
  sheriff_sale: "auction",
  tax_deed: "auction",
  tax_deed_auction: "auction",
  tax_certificate: "auction",
  reo: "reo",
  bank_owned: "reo",
  certificate_of_title: "reo",
  sheriff_deed: "reo",
};

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v).trim() || undefined;
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function normalizeType(v: unknown): ForeclosureRecordType {
  const key = String(v ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return RECORD_TYPE_MAP[key] ?? RECORD_TYPE_MAP[key.replace(/_/g, "")] ?? "lis_pendens";
}

export function extractArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "records", "results", "items", "rows"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

export function normalizeRow(
  row: Record<string, unknown>,
  defaults: { county: string; state: string; sourceUrl?: string },
): RawForeclosureRecord | null {
  const address = str(pick(row, "addressLine1", "address", "street_address", "site_address", "property_address", "situs"));
  const city = str(pick(row, "city", "property_city", "site_city"));
  if (!address || !city) return null;

  return {
    county: str(pick(row, "county")) ?? defaults.county,
    state: str(pick(row, "state", "st")) ?? defaults.state,
    recordType: normalizeType(pick(row, "recordType", "record_type", "type", "document_type", "doc_type")),
    caseNumber: str(pick(row, "caseNumber", "case_number", "case", "instrument", "document_number", "file_number")),
    sourceUrl: str(pick(row, "sourceUrl", "source_url", "url", "link")) ?? defaults.sourceUrl,
    addressLine1: address,
    city,
    zip: str(pick(row, "zip", "zipcode", "zip_code", "postal_code")),
    ownerName: str(pick(row, "ownerName", "owner_name", "owner", "grantor", "defendant")),
    estimatedValue: num(pick(row, "estimatedValue", "estimated_value", "value", "avm", "assessed_value")),
    openingBid: num(pick(row, "openingBid", "opening_bid", "min_bid", "minimum_bid", "bid")),
    auctionDate: str(pick(row, "auctionDate", "auction_date", "sale_date")),
    filingDate: str(pick(row, "filingDate", "filing_date", "file_date", "recording_date", "recorded")),
    lat: num(pick(row, "lat", "latitude")),
    lng: num(pick(row, "lng", "lon", "longitude")),
    raw: row,
  };
}
