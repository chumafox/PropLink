import { addCountyConnector } from "../queries/countyConnectors";

export interface NetrPortalInfo {
  county: string;
  state: string;
  assessorUrl?: string;
  recorderUrl?: string;
  taxCollectorUrl?: string;
  foreclosureUrl?: string;
  phone?: string;
  sourceUrl: string;
}

export interface NetrCountyItem {
  name: string;
  slug: string;
  url: string;
}

/**
 * Scrapes a state page on NETR Online to find all county links.
 * Returns array of formatted county items.
 */
export async function getCountyListForState(stateCode: string): Promise<NetrCountyItem[]> {
  const stateUpper = stateCode.toUpperCase();
  const url = `https://publicrecords.netronline.com/state/${stateUpper}`;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured in environment variables.");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["links"],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { success: boolean; data?: { links?: string[] } };
  const links = data.data?.links ?? [];

  const countyPattern = new RegExp(`/state/${stateUpper}/county/([A-Za-z0-9_-]+)`, "i");
  const uniqueCounties = new Map<string, NetrCountyItem>();

  for (const rawUrl of links) {
    const match = rawUrl.match(countyPattern);
    if (match) {
      const slug = match[1].toLowerCase();
      if (!uniqueCounties.has(slug)) {
        const rawName = slug.replace(/_/g, " ");
        const name = rawName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        const fullUrl = rawUrl.startsWith("http")
          ? rawUrl
          : `https://publicrecords.netronline.com${rawUrl}`;

        uniqueCounties.set(slug, { name, slug, url: fullUrl });
      }
    }
  }

  return Array.from(uniqueCounties.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scrapes a single county page on NETR Online to extract portal links.
 */
export async function scrapeCountyPortals(countyUrl: string): Promise<NetrPortalInfo | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured in environment variables.");
  }

  const match = countyUrl.match(/\/state\/([A-Za-z]{2})\/county\/([A-Za-z0-9_-]+)/i);
  if (!match) return null;

  const state = match[1].toUpperCase();
  const rawCounty = match[2].replace(/_/g, " ");
  const countyName = rawCounty
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: countyUrl,
      formats: ["json"],
      jsonOptions: {
        prompt: `Extract public records links for ${countyName} County, ${state}. Find the Assessor / Property Appraiser link, Clerk / Recorder link, Tax Collector link, and any Public Trustee or Foreclosure link.`,
        schema: {
          type: "object",
          properties: {
            county: { type: "string" },
            state: { type: "string" },
            assessorUrl: { type: "string" },
            recorderUrl: { type: "string" },
            taxCollectorUrl: { type: "string" },
            foreclosureUrl: { type: "string" },
            phone: { type: "string" },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`Failed to scrape ${countyUrl}: ${response.status}`);
    return null;
  }

  const resData = (await response.json()) as {
    success: boolean;
    data?: { json?: Partial<NetrPortalInfo> };
  };

  const extracted = resData.data?.json;
  return {
    county: extracted?.county || countyName,
    state: extracted?.state || state,
    assessorUrl: extracted?.assessorUrl,
    recorderUrl: extracted?.recorderUrl,
    taxCollectorUrl: extracted?.taxCollectorUrl,
    foreclosureUrl: extracted?.foreclosureUrl,
    phone: extracted?.phone,
    sourceUrl: countyUrl,
  };
}

/**
 * Scrapes and saves ONE specific selected county into county_connectors.
 */
export async function crawlAndSaveSingleCounty(countyUrl: string, userId: number) {
  const portalInfo = await scrapeCountyPortals(countyUrl);
  if (!portalInfo) {
    throw new Error("Could not extract portal information for the selected county.");
  }

  const sourceUrl = portalInfo.foreclosureUrl || portalInfo.recorderUrl || portalInfo.sourceUrl;
  const isApi = sourceUrl.includes("/api/") || sourceUrl.endsWith(".json");
  const sourceType = isApi ? "json_api" : "html";
  const notes = [
    portalInfo.foreclosureUrl ? `Foreclosure Portal: ${portalInfo.foreclosureUrl}` : "",
    portalInfo.recorderUrl ? `Recorder: ${portalInfo.recorderUrl}` : "",
    portalInfo.assessorUrl ? `Assessor: ${portalInfo.assessorUrl}` : "",
    portalInfo.phone ? `Phone: ${portalInfo.phone}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const connectorId = await addCountyConnector(userId, {
    county: portalInfo.county,
    state: portalInfo.state,
    sourceUrl,
    sourceType,
    notes,
  });

  return {
    connectorId,
    portalInfo,
  };
}
