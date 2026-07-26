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

/**
 * Scrapes a single state page on NETR Online to find all county links.
 * Example stateUrl: "https://publicrecords.netronline.com/state/FL"
 */
export async function getCountyUrlsForState(stateCode: string): Promise<string[]> {
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

  // Filter links for county paths: e.g. "/state/FL/county/hillsborough"
  const countyLinks = links.filter((l) =>
    l.toLowerCase().includes(`/state/${stateUpper.toLowerCase()}/county/`)
  );

  return Array.from(new Set(countyLinks));
}

/**
 * Scrapes a single county page on NETR Online to extract portal links.
 * Uses Firecrawl structured JSON extraction format.
 */
export async function scrapeCountyPortals(countyUrl: string): Promise<NetrPortalInfo | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured in environment variables.");
  }

  // Parse state and county from URL: /state/FL/county/hillsborough
  const match = countyUrl.match(/\/state\/([A-Za-z]{2})\/county\/([A-Za-z0-9_-]+)/i);
  if (!match) return null;

  const state = match[1].toUpperCase();
  const rawCounty = match[2].replace(/_/g, " ");
  const countyName = rawCounty.charAt(0).toUpperCase() + rawCounty.slice(1);

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
 * Main crawler method to discover and import county sources for a state into county_connectors.
 */
export async function crawlAndSaveStateCounties(stateCode: string, userId: number) {
  const countyUrls = await getCountyUrlsForState(stateCode);
  const results: NetrPortalInfo[] = [];

  // Scrape counties (limit batch to top 10 for performance/credit protection)
  const targetUrls = countyUrls.slice(0, 10);

  for (const url of targetUrls) {
    try {
      const portalInfo = await scrapeCountyPortals(url);
      if (portalInfo) {
        results.push(portalInfo);

        // Save or update in database
        const sourceUrl = portalInfo.foreclosureUrl || portalInfo.recorderUrl || portalInfo.sourceUrl;
        const sourceType = portalInfo.foreclosureUrl ? "json_api" : "html";
        const notes = [
          portalInfo.foreclosureUrl ? `Foreclosure Portal: ${portalInfo.foreclosureUrl}` : "",
          portalInfo.recorderUrl ? `Recorder: ${portalInfo.recorderUrl}` : "",
          portalInfo.assessorUrl ? `Assessor: ${portalInfo.assessorUrl}` : "",
          portalInfo.phone ? `Phone: ${portalInfo.phone}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        await addCountyConnector(userId, {
          county: portalInfo.county,
          state: portalInfo.state,
          sourceUrl,
          sourceType,
          notes,
        });
      }
    } catch (err) {
      console.error(`Error crawling ${url}:`, err);
    }
  }

  return {
    state: stateCode.toUpperCase(),
    totalDiscovered: countyUrls.length,
    processedCount: results.length,
    counties: results,
  };
}
