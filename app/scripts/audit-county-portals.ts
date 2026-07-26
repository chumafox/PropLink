import fs from "fs";

export interface PortalAuditResult {
  url: string;
  county: string;
  state: string;
  statusCode?: number;
  contentType?: string;
  detectedVendor: "real_auction" | "tyler_eagle" | "govos_landmark" | "aspnet_webforms" | "direct_api" | "firecrawl_ai";
  notes: string;
}

export async function auditCountyPortal(url: string, county: string, state: string): Promise<PortalAuditResult> {
  const lowerUrl = url.toLowerCase();

  // Pattern checks based on domain / vendor signatures
  if (lowerUrl.includes("realforeclose.com") || lowerUrl.includes("taxdeedauction.com")) {
    return {
      url,
      county,
      state,
      detectedVendor: "real_auction",
      notes: "Detected RealAuction / GrantStreet auction portal grid.",
    };
  }

  if (lowerUrl.includes("eaglerecorder") || lowerUrl.includes("/eagle/")) {
    return {
      url,
      county,
      state,
      detectedVendor: "tyler_eagle",
      notes: "Detected Tyler Technologies Eagle Recorder WebForms.",
    };
  }

  if (lowerUrl.includes("landrecords") || lowerUrl.includes("landmark.")) {
    return {
      url,
      county,
      state,
      detectedVendor: "govos_landmark",
      notes: "Detected GovOS / Kofile Landmark SPA.",
    };
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "PropLink-Auditor/1.0" },
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return {
        url,
        county,
        state,
        statusCode: res.status,
        contentType,
        detectedVendor: "direct_api",
        notes: "Direct JSON API endpoint.",
      };
    }

    const text = await res.text();
    if (text.includes("__VIEWSTATE") || text.includes("ASP.NET_SessionId")) {
      return {
        url,
        county,
        state,
        statusCode: res.status,
        contentType,
        detectedVendor: "aspnet_webforms",
        notes: "ASP.NET WebForms with __VIEWSTATE and session cookies.",
      };
    }

    return {
      url,
      county,
      state,
      statusCode: res.status,
      contentType,
      detectedVendor: "firecrawl_ai",
      notes: "General HTML/SPA portal, best scraped via Firecrawl AI extraction.",
    };
  } catch (err: any) {
    return {
      url,
      county,
      state,
      detectedVendor: "firecrawl_ai",
      notes: `Fetch failed (${err.message}). Using Firecrawl AI stealth rendering fallback.`,
    };
  }
}

// Example execution if run via CLI: npx tsx scripts/audit-county-portals.ts
if (process.argv[1]?.includes("audit-county-portals")) {
  console.log("🚀 Running County Portal Audit & Classifier...");
  const samplePortals = [
    { url: "https://www.alachuacounty.us/depts/clerk/publicrecords/pages/officialrecords.aspx", county: "Alachua", state: "FL" },
    { url: "http://dnr.alaska.gov/ssd/recoff/searchRO.cfm", county: "Anchorage", state: "AK" },
    { url: "https://broward.realforeclose.com/", county: "Broward", state: "FL" },
  ];

  Promise.all(samplePortals.map((p) => auditCountyPortal(p.url, p.county, p.state))).then((results) => {
    console.table(results);
    fs.writeFileSync("app/db/county_audit_report.json", JSON.stringify(results, null, 2));
    console.log("✅ Audit report saved to app/db/county_audit_report.json");
  });
}
