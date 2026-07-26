import { getDb } from "./queries/connection";
import { listings } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import type { Listing } from "@db/schema";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export function injectListingMeta(
  html: string,
  l: Listing,
  origin: string,
): string {
  const url = `${origin}/listings/${l.id}`;
  const title = `${fmt(l.price)} — ${l.addressLine1}, ${l.city}, ${l.state} ${l.zip} | PropLink`;
  const specs = [
    l.beds ? `${l.beds} bd` : null,
    l.baths ? `${l.baths} ba` : null,
    l.sqft ? `${l.sqft.toLocaleString("en-US")} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = (
    l.description?.slice(0, 150) ||
    `${l.propertyType} for sale in ${l.city}, ${l.state}. ${specs}. Listed on PropLink — make a structured offer directly to the decision maker.`
  ).replace(/\s+/g, " ");
  const image = l.photos?.[0]
    ? l.photos[0].startsWith("http")
      ? l.photos[0]
      : `${origin}${l.photos[0]}`
    : `${origin}/photos/hero.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    description,
    url,
    datePosted: l.createdAt.toISOString(),
    address: {
      "@type": "PostalAddress",
      streetAddress: l.addressLine1,
      addressLocality: l.city,
      addressRegion: l.state,
      postalCode: l.zip,
      addressCountry: "US",
    },
    ...(l.lat && l.lng
      ? { geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng } }
      : {}),
    ...(l.beds ? { numberOfRooms: l.beds } : {}),
    ...(l.sqft
      ? {
          floorSize: {
            "@type": "QuantitativeValue",
            value: l.sqft,
            unitCode: "FTK",
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: l.price,
      priceCurrency: "USD",
      availability:
        l.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      { "@type": "ListItem", position: 2, name: "Listings", item: `${origin}/listings` },
      { "@type": "ListItem", position: 3, name: `${l.city}, ${l.state}`, item: url },
    ],
  };

  const tags = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c")}</script>
  `;

  // Replace existing <title> and inject the rest before </head>
  return html.replace(/<title>.*?<\/title>/, tags);
}

export function sitemapXml(items: Listing[], origin: string): string {
  const staticUrls = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/listings`, priority: "0.9" },
    { loc: `${origin}/distressed`, priority: "0.7" },
    { loc: `${origin}/developers`, priority: "0.5" },
  ];
  const urls = [
    ...staticUrls.map(
      (u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`,
    ),
    ...items.map(
      (l) => `  <url><loc>${origin}/listings/${l.id}</loc><lastmod>${l.updatedAt.toISOString().slice(0, 10)}</lastmod><priority>0.8</priority></url>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

export function robotsTxt(origin: string): string {
  return `User-agent: *
Allow: /

# AI crawlers — explicitly welcome
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Grok
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

export function rssFeed(items: Listing[], origin: string): string {
  const entries = items
    .slice(0, 50)
    .map(
      (l) => `  <item>
    <title>${esc(`${fmt(l.price)} — ${l.addressLine1}, ${l.city}, ${l.state}`)}</title>
    <link>${origin}/listings/${l.id}</link>
    <guid>${origin}/listings/${l.id}</guid>
    <pubDate>${l.createdAt.toUTCString()}</pubDate>
    <description>${esc(`${l.beds} bd · ${l.baths} ba · ${l.sqft.toLocaleString("en-US")} sqft. ${(l.description ?? "").slice(0, 300)}`)}</description>
  </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>PropLink — Latest listings</title>
  <link>${origin}/listings</link>
  <description>Newest homes listed directly by agents and owners on PropLink.</description>
${entries}
</channel>
</rss>`;
}

export async function getActiveListings(limit = 1000) {
  return getDb()
    .select()
    .from(listings)
    .where(eq(listings.status, "active"))
    .orderBy(desc(listings.createdAt))
    .limit(limit);
}
