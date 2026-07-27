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

  const lowerUrl = sourceUrl.toLowerCase();
  const isInteractivePortal =
    lowerUrl.includes("duprocess") ||
    lowerUrl.includes("inquiry") ||
    lowerUrl.includes("bakerclerk") ||
    lowerUrl.includes("publicrecords");

  const actions = isInteractivePortal
    ? [
        { type: "click", selector: "a.btn-success, .btn-primary, button[type='submit']" },
        { type: "wait", milliseconds: 1500 },
        { type: "click", selector: "#file_date_90, #file_date_30, input[value='90']" },
        { type: "wait", milliseconds: 1000 },
        { type: "click", selector: "a.btn-success, .btn-primary, input[value='Search']" },
        { type: "wait", milliseconds: 6000 },
      ]
    : undefined;

  const currentYear = new Date().getFullYear();
  const prompt = [
    `Extract ONLY foreclosure and pre-foreclosure records from this county public records portal for ${county} County, ${state}.`,
    `INCLUDE ONLY these document types: Lis Pendens, Notice of Default (NOD), Notice of Sale (NOS), Notice of Trustee Sale (NTS), Foreclosure, Foreclosure Complaint, Sheriff Sale, Tax Deed Sale, REO.`,
    `STRICTLY EXCLUDE: Deed, Warranty Deed, Quit Claim Deed, Mortgage, Release of Mortgage, Satisfaction, Lien, Judgment, Affidavit, Assignment, Easement, Plat, Agreement, and any other non-foreclosure document types.`,
    `IMPORTANT: Only include records with filing dates or auction dates in ${currentYear} or future years. Skip anything dated ${currentYear - 1} or earlier.`,
    `For each qualifying record return: caseNumber, recordType (exact document type from the portal), addressLine1 (property street address), city, zip, ownerName, filingDate, auctionDate, estimatedValue, openingBid.`,
    `If the address field is empty or unavailable, still include the record with an empty addressLine1.`,
  ].join(" ");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: sourceUrl,
      formats: ["json"],
      actions,
      waitFor: isInteractivePortal ? 7000 : 5000,
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
