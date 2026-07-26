import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { restApp } from "./rest";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.route("/api/v1", restApp);

// ---- Omnichannel webhooks (Meta: FB/IG/WhatsApp) ----
const { channelWebhooks } = await import("./channels/webhooks");
app.route("/api/webhooks/channels", channelWebhooks);

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// ---- MCP server (for AI agents: Claude Code, Kimi Code, Codex, …) ----
const { mcpHandler } = await import("./mcp");
app.all("/mcp", mcpHandler);

// ---- SEO / GEO endpoints (production: served before the SPA fallback) ----
if (env.isProduction) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const seo = await import("./seo");
  const geo = await import("./geo");
  const { findListingById } = await import("./queries/listings");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const indexPath = path.resolve(here, "public/index.html");
  const readIndex = () => fs.readFileSync(indexPath, "utf-8");
  const originOf = (c: any) => new URL(c.req.url).origin;

  app.get("/sitemap.xml", async (c) => {
    const items = await seo.getActiveListings(2000);
    return c.text(seo.sitemapXml(items, originOf(c)), 200, {
      "Content-Type": "application/xml",
    });
  });

  app.get("/robots.txt", (c) =>
    c.text(seo.robotsTxt(originOf(c)), 200, { "Content-Type": "text/plain" }),
  );

  app.get("/llms.txt", (c) =>
    c.text(geo.llmsTxt(originOf(c)), 200, { "Content-Type": "text/plain" }),
  );

  app.get("/feed.xml", async (c) => {
    const items = await seo.getActiveListings(50);
    return c.text(seo.rssFeed(items, originOf(c)), 200, {
      "Content-Type": "application/rss+xml",
    });
  });

  // Server-injected meta for listing pages — critical for crawlers
  // and AI agents that don't execute JavaScript.
  app.get("/listings/:id", async (c, next) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return next(); // e.g. /listings/new
    const row = await findListingById(id).catch(() => null);
    const html = readIndex();
    if (!row) return c.html(html);
    return c.html(seo.injectListingMeta(html, row.listing, originOf(c)));
  });
}

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
