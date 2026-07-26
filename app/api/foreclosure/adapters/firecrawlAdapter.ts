import type { RawForeclosureRecord } from "../connectors";
import { normalizeRow } from "../normalize";

export async function scrapeCountyWithFirecrawl(
  sourceUrl: string,
  county: string,
  state: string,
): Promise<RawForeclosureRecord[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set. Firecrawl API key is required to scrape HTML/PDF county portals.",
    );
  }

  const prompt = `Extract all foreclosure and pre-foreclosure records (Lis Pendens, Notice of Default, Notice of Sale, Foreclosure Auction, REO) from this county public records page for ${county} County, ${state}. Return a list of records with their case number, property address, city, zip code, owner name, record type, filing date, auction date, estimated value, and opening bid if available.`;

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: sourceUrl,
      formats: ["json"],
      waitFor: 5000,
      jsonOptions: {
        prompt,
        schema: {
          type: "object",
          properties: {
            records: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  caseNumber: { type: "string" },
                  recordType: { type: "string" },
                  addressLine1: { type: "string" },
                  city: { type: "string" },
                  zip: { type: "string" },
                  ownerName: { type: "string" },
                  filingDate: { type: "string" },
                  auctionDate: { type: "string" },
                  estimatedValue: { type: "number" },
                  openingBid: { type: "number" },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Firecrawl scraping failed for ${sourceUrl}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const resData = (await response.json()) as {
    success: boolean;
    data?: {
      json?: {
        records?: Record<string, unknown>[];
      };
    };
  };

  const rawRows = resData.data?.json?.records ?? [];
  const normalized: RawForeclosureRecord[] = [];

  for (const row of rawRows) {
    const norm = normalizeRow(row, {
      county,
      state,
      sourceUrl,
    });
    if (norm) {
      normalized.push(norm);
    }
  }

  return normalized;
}
