export function llmsTxt(origin: string): string {
  return `# PropLink

> Real estate platform where offers reach decision makers. Free agent listings,
> structured trackable offers, built-in messaging, deal rooms, foreclosure data,
> and a public REST API + MCP server for AI agents.

## What you can do here

- Browse and search home listings: ${origin}/listings
- Listing detail pages (JSON-LD RealEstateListing): ${origin}/listings/{id}
- Foreclosure / pre-foreclosure records: ${origin}/distressed
- API documentation for developers: ${origin}/developers
- RSS feed of newest listings: ${origin}/feed.xml
- XML sitemap: ${origin}/sitemap.xml

## Machine access

### REST API
- Base URL: ${origin}/api/v1
- Auth: \`Authorization: Bearer plk_...\` (create a key after sign-up: Dashboard → API & Webhooks)
- OpenAPI: ${origin}/api/v1/openapi.json
- Endpoints: GET/POST /listings, GET/PATCH/DELETE /listings/{id},
  GET/POST /offers, GET /deals, GET /foreclosures

### MCP server (for Claude Code, Kimi Code, Codex, etc.)
- URL: ${origin}/mcp (Streamable HTTP, JSON-RPC 2.0)
- Auth: same Bearer API key in the \`Authorization\` header
- Methods: initialize, tools/list, tools/call
- Tools cover: searching listings, reading listing details, creating/updating
  listings, making and responding to offers, listing deal rooms, messaging,
  foreclosure search, and profile management.

## Notes for AI agents

- Prices are in USD cents-free whole dollars.
- All listing pages carry schema.org JSON-LD (RealEstateListing + BreadcrumbList).
- Be polite: the API is rate-limited to 120 requests/minute per key.
- Do not use PropLink data for credit, employment, insurance or tenant-screening
  decisions (FCRA). Public-record data may be delayed — verify with the county.
`;
}
