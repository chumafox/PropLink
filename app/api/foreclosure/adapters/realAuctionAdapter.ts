import type { RawForeclosureRecord } from "../connectors";

/**
 * Adapter for RealAuction / GrantStreet auction sites (e.g. county.realforeclose.com).
 * Uses Firecrawl HTML scraping / structured extraction focused on auction grids & property listings.
 */
export async function scrapeRealAuctionPortal(
  sourceUrl: string,
  county: string,
  state: string,
): Promise<RawForeclosureRecord[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is required to scrape RealAuction portals.");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: sourceUrl,
      formats: ["json"],
      waitFor: 6000,
      jsonOptions: {
        prompt: `Extract all foreclosure auction items from this RealAuction grid for ${county} County, ${state}. For each item extract caseNumber, parcelId / property address, city, openingBid, estimatedValue, auctionDate, and status.`,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  caseNumber: { type: "string" },
                  addressLine1: { type: "string" },
                  city: { type: "string" },
                  zip: { type: "string" },
                  openingBid: { type: "number" },
                  estimatedValue: { type: "number" },
                  auctionDate: { type: "string" },
                  ownerName: { type: "string" },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RealAuction Firecrawl scrape failed: HTTP ${response.status}`);
  }

  const resData = (await response.json()) as {
    data?: { json?: { items?: Record<string, unknown>[] } };
  };

  const rawItems = resData.data?.json?.items ?? [];

  return rawItems.map((item) => ({
    county,
    state,
    recordType: "auction",
    caseNumber: (item.caseNumber as string) || undefined,
    sourceUrl,
    addressLine1: (item.addressLine1 as string) || `${county} Foreclosure Parcel`,
    city: (item.city as string) || county,
    zip: (item.zip as string) || undefined,
    ownerName: (item.ownerName as string) || undefined,
    openingBid: typeof item.openingBid === "number" ? item.openingBid : undefined,
    estimatedValue: typeof item.estimatedValue === "number" ? item.estimatedValue : undefined,
    auctionDate: (item.auctionDate as string) || undefined,
    raw: item,
  }));
}
