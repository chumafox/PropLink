import type { RawForeclosureRecord } from "../connectors";
import { isFreshRecord, normalizeRow } from "../normalize";

declare const document: any;
declare const HTMLElement: any;

/**
 * Playwright-based headless browser adapter for SPA portals (Angular/React).
 * Handles DuProcess, Tyler Eagle SPA, GovOS portals, and other JS-heavy sites.
 *
 * Why Playwright instead of Firecrawl?
 * - DuProcess portals return 403 to headless crawlers without proper user-agent
 * - SPA portals require JS execution + DOM interaction to reveal data
 * - Angular SPA pages need waiting for `ngIf` and zone stability
 */
export async function scrapeSpaPortal(
  sourceUrl: string,
  county: string,
  state: string,
): Promise<RawForeclosureRecord[]> {
  // Dynamic import to avoid loading Playwright if not needed
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    // Block tracking/analytics to speed up loading
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  // Intercept and block unnecessary resources for speed
  await context.route("**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf}", (route) =>
    route.abort(),
  );
  await context.route("**/{analytics,tracking,googletagmanager}**", (route) => route.abort());

  const page = await context.newPage();
  const records: RawForeclosureRecord[] = [];

  try {
    const lowerUrl = sourceUrl.toLowerCase();

    // ── DuProcess SPA (bakerclerk.com / DuProcessWebInquiry) ──────────────────
    if (lowerUrl.includes("duprocess") || lowerUrl.includes("duprocessweb")) {
      await scrapeDuProcess(page, sourceUrl, county, state, records);
    }
    // ── Tyler iasWorld / Eagle SPA ─────────────────────────────────────────────
    else if (lowerUrl.includes("iasworld") || lowerUrl.includes("tyler")) {
      await scrapeTylerEagle(page, sourceUrl, county, state, records);
    }
    // ── Generic SPA fallback – try to extract table data after load ───────────
    else {
      await scrapeGenericSpa(page, sourceUrl, county, state, records);
    }
  } catch (err) {
    console.error(`[PlaywrightSPA] Error scraping ${sourceUrl}:`, err);
  } finally {
    await browser.close();
  }

  return records.filter((r) => isFreshRecord(r));
}

// ─── DuProcess Portal Scraper ─────────────────────────────────────────────────
async function scrapeDuProcess(
  page: import("playwright").Page,
  url: string,
  county: string,
  state: string,
  out: RawForeclosureRecord[],
) {
  console.log(`[DuProcess] Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // DuProcess has a "Disclaimer" acceptance page – click Accept if present
  const acceptBtn = page.locator(
    "button:has-text('I Accept'), button:has-text('Accept'), .btn-success:has-text('Accept')",
  );
  if (await acceptBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await acceptBtn.first().click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  }

  // Select date range: last 90 days + future (we want filings from recent months)
  const dateRange = page.locator(
    "select#dateRange, select[name='dateRange'], input[value='90'], #file_date_90",
  );
  if (await dateRange.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    const tagName = await dateRange.first().evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "select") {
      await dateRange.first().selectOption({ value: "90" });
    } else {
      await dateRange.first().click();
    }
  }

  // Search for foreclosure-related document types
  const docTypeInput = page.locator(
    "input[placeholder*='doc'], input[name*='docType'], select[name*='doc']",
  );
  if (await docTypeInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    const tagName = await docTypeInput.first().evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "input") {
      await docTypeInput.first().fill("LIS PENDENS");
    }
  }

  // Submit search
  const submitBtn = page.locator(
    "button[type='submit'], input[type='submit'], button:has-text('Search'), .btn-primary:has-text('Search')",
  );
  if (await submitBtn.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await submitBtn.first().click();
    await page.waitForLoadState("networkidle", { timeout: 20000 });
  }

  // Wait for results table
  await page.waitForSelector("table tbody tr, .result-row, [data-case]", {
    timeout: 15000,
  }).catch(() => null);

  // Extract structured data from results via page.evaluate
  const rawData = await page.evaluate(() => {
    const rows: Record<string, string>[] = [];
    // Standard HTML table rows
    document.querySelectorAll("table tbody tr").forEach((tr: any) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td: any) =>
        String(td?.innerText || "").trim(),
      );
      if (cells.length >= 3) {
        rows.push({
          col0: cells[0] || "",
          col1: cells[1] || "",
          col2: cells[2] || "",
          col3: cells[3] || "",
          col4: cells[4] || "",
          col5: cells[5] || "",
          col6: cells[6] || "",
          col7: cells[7] || "",
        });
      }
    });

    // Angular material table / data grid rows
    if (rows.length === 0) {
      document.querySelectorAll("mat-row, .ag-row, [role='row']").forEach((row: any) => {
        const cells = Array.from(
          row.querySelectorAll("mat-cell, .ag-cell, [role='gridcell']"),
        ).map((c: any) => String((c as any)?.innerText || "").trim());
        if (cells.length >= 2) {
          rows.push(Object.fromEntries(cells.map((c: string, i: number) => [`col${i}`, c])));
        }
      });
    }

    // Try JSON from page data attributes or window variables
    const pageText = document.body.innerText;
    return { rows, pageText: pageText.substring(0, 5000) };
  });

  if (rawData.rows.length === 0) {
    console.warn(`[DuProcess] No table rows found for ${url}. Page snippet:\n${rawData.pageText.substring(0, 500)}`);
    return;
  }

  console.log(`[DuProcess] Found ${rawData.rows.length} raw rows`);

  // Attempt to map columns heuristically
  // DuProcess table columns vary by county – try common patterns
  for (const row of rawData.rows) {
    const values = Object.values(row);
    const fullText = values.join(" ");

    // Detect record type from row text
    const lowerText = fullText.toLowerCase();
    let recordType = "lis_pendens";
    if (lowerText.includes("notice of sale") || lowerText.includes("nos")) recordType = "notice_of_sale";
    else if (lowerText.includes("notice of default") || lowerText.includes("nod")) recordType = "notice_of_default";
    else if (lowerText.includes("auction") || lowerText.includes("forecl")) recordType = "auction";

    // Try to find date-like values
    const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}/;
    const dates = values.filter((v) => dateRegex.test(v));

    // Find case number (usually alphanumeric, starts with number or "CA-" "FC-" etc.)
    const caseRegex = /^[\w\-]{5,25}$/;
    const possibleCase = values.find((v) => caseRegex.test(v) && /\d/.test(v));

    // Find address (contains a number + street name)
    const addrRegex = /\d+\s+\w+/;
    const possibleAddr = values.find((v) => addrRegex.test(v) && v.length > 10);

    const norm = normalizeRow(
      {
        caseNumber: possibleCase,
        recordType,
        addressLine1: possibleAddr,
        filingDate: dates[0],
        auctionDate: dates[1],
        raw: values.join(" | "),
      },
      { county, state, sourceUrl: url },
    );

    if (norm) out.push(norm);
  }
}

// ─── Tyler Eagle SPA ─────────────────────────────────────────────────────────
async function scrapeTylerEagle(
  page: import("playwright").Page,
  url: string,
  county: string,
  state: string,
  out: RawForeclosureRecord[],
) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // Tyler Eagle intercept: listen for XHR/fetch responses containing JSON data
  const jsonPayloads: unknown[] = [];
  page.on("response", async (response) => {
    const ct = response.headers()["content-type"] || "";
    if (ct.includes("application/json") && response.status() === 200) {
      try {
        const body = await response.json();
        jsonPayloads.push(body);
      } catch {}
    }
  });

  await page.waitForTimeout(5000);

  for (const payload of jsonPayloads) {
    if (!payload || typeof payload !== "object") continue;
    const arr = extractJsonArray(payload as Record<string, unknown>);
    for (const row of arr) {
      const norm = normalizeRow(row as Record<string, unknown>, { county, state, sourceUrl: url });
      if (norm) out.push(norm);
    }
  }
}

// ─── Generic SPA Fallback ─────────────────────────────────────────────────────
async function scrapeGenericSpa(
  page: import("playwright").Page,
  url: string,
  county: string,
  state: string,
  out: RawForeclosureRecord[],
) {
  const jsonPayloads: unknown[] = [];

  page.on("response", async (response) => {
    const ct = response.headers()["content-type"] || "";
    if (ct.includes("application/json") && response.status() === 200) {
      try {
        const body = await response.json();
        jsonPayloads.push(body);
      } catch {}
    }
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);

  for (const payload of jsonPayloads) {
    if (!payload || typeof payload !== "object") continue;
    const arr = extractJsonArray(payload as Record<string, unknown>);
    for (const row of arr) {
      const norm = normalizeRow(row as Record<string, unknown>, { county, state, sourceUrl: url });
      if (norm) out.push(norm);
    }
  }

  // If no JSON captured, fall back to table scraping
  if (out.length === 0) {
    const tableData = await page.evaluate(() => {
      const rows: Record<string, string>[] = [];
      document.querySelectorAll("table tbody tr").forEach((tr: any) => {
        const cells = Array.from(tr.querySelectorAll("td")).map((td: any) =>
          String((td as any)?.innerText || "").trim(),
        );
        if (cells.length >= 2)
          rows.push(Object.fromEntries(cells.map((c: string, i: number) => [`col${i}`, c])));
      });
      return rows;
    });

    for (const row of tableData) {
      const norm = normalizeRow(row, { county, state, sourceUrl: url });
      if (norm) out.push(norm);
    }
  }
}

// ─── Helper: extract arrays from nested JSON ──────────────────────────────────
function extractJsonArray(obj: Record<string, unknown>): unknown[] {
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val;
    if (val && typeof val === "object") {
      const nested = extractJsonArray(val as Record<string, unknown>);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}
