import type { ForeclosureRecordType } from "@db/schema";
import type { RawForeclosureRecord } from "../connectors";

export type VendorPlatform =
  | "tyler_eagle"
  | "govos_landmark"
  | "real_auction"
  | "aspnet_webforms"
  | "firecrawl_ai"
  | "direct_api";

export interface CountyScraperConfig {
  countyId: string; // e.g. "alachua-fl"
  state: string;
  countyName: string;
  vendorPlatform: VendorPlatform;
  strategy: "direct_api" | "aspnet_webforms" | "firecrawl_ai" | "custom_adapter";
  baseUrl: string;
  disclaimerRequired?: boolean;
  disclaimerUrl?: string;
  searchEndpoint?: {
    url: string;
    method: "GET" | "POST";
    docTypes?: string[];
    payloadTemplate?: Record<string, unknown>;
  };
}

export interface AdapterSyncResult {
  fetched: number;
  valid: number;
  records: RawForeclosureRecord[];
  sourceUrl: string;
}
