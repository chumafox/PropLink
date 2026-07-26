import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { listingInputSchema } from "@contracts/listing";
import {
  searchListings,
  findListingById,
  createListing,
  updateListing,
  deleteListing,
  getListingOwnerId,
} from "./queries/listings";
import { createOffer, findOffersByBuyer, findOffersForOwner } from "./queries/offers";
import { listDealsForUser } from "./queries/deals";
import { searchForeclosures } from "./queries/foreclosures";
import { findKeyByToken, touchKey } from "./queries/apikeys";
import { dispatchWebhookEvent } from "./queries/webhookQueries";
import { notifyListingMatches } from "./queries/savedSearches";
import { createNotification } from "./queries/notifications";
import { financingTypes } from "@db/schema";

// --- naive per-key rate limiter: 120 req/min (in-memory) ---
const buckets = new Map<number, { count: number; resetAt: number }>();
function rateLimit(keyId: number): boolean {
  const now = Date.now();
  const b = buckets.get(keyId);
  if (!b || b.resetAt < now) {
    buckets.set(keyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 120) return false;
  b.count++;
  return true;
}

type Vars = { userId: number; keyId: number };
export const restApp = new Hono<{ Variables: Vars }>();

restApp.use("*", cors());

restApp.get("/openapi.json", (c) => c.json(openApiDoc));

// --- auth: Bearer API key ---
restApp.use("*", async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return c.json(
      { error: "Missing API key. Use: Authorization: Bearer plk_..." },
      401,
    );
  }
  const key = await findKeyByToken(token);
  if (!key) return c.json({ error: "Invalid or revoked API key" }, 401);
  if (!rateLimit(key.id)) {
    return c.json({ error: "Rate limit exceeded (120 req/min)" }, 429);
  }
  c.set("userId", key.userId);
  c.set("keyId", key.id);
  void touchKey(key.id).catch(() => {});
  return next();
});

// --- Listings ---
restApp.get("/listings", async (c) => {
  const q = c.req.query();
  const result = await searchListings({
    q: q.q,
    city: q.city,
    state: q.state,
    propertyType: q.propertyType,
    minPrice: q.minPrice ? Number(q.minPrice) : undefined,
    maxPrice: q.maxPrice ? Number(q.maxPrice) : undefined,
    minBeds: q.minBeds ? Number(q.minBeds) : undefined,
    sort: (q.sort as any) ?? "newest",
    limit: q.limit ? Math.min(Number(q.limit), 100) : 50,
    offset: q.offset ? Number(q.offset) : 0,
    status: (q.status as any) ?? "active",
  });
  return c.json(result);
});

restApp.get("/listings/:id", async (c) => {
  const row = await findListingById(Number(c.req.param("id")));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

restApp.post("/listings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = listingInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }
  const listing = await createListing({
    ...parsed.data,
    ownerId: c.get("userId"),
  });
  void dispatchWebhookEvent([c.get("userId")], "listing.created", listing);
  void notifyListingMatches(listing).catch(() => {});
  return c.json(listing, 201);
});

restApp.patch("/listings/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => null);
  const parsed = listingInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }
  const row = await updateListing(id, c.get("userId"), parsed.data);
  if (!row) return c.json({ error: "Not found or not yours" }, 404);
  void dispatchWebhookEvent([c.get("userId")], "listing.updated", row);
  return c.json(row);
});

restApp.delete("/listings/:id", async (c) => {
  await deleteListing(Number(c.req.param("id")), c.get("userId"));
  return c.json({ ok: true });
});

// --- Offers ---
restApp.get("/offers", async (c) => {
  const box = c.req.query("box") ?? "sent";
  const rows =
    box === "received"
      ? await findOffersForOwner(c.get("userId"))
      : await findOffersByBuyer(c.get("userId"));
  return c.json({ items: rows });
});

const offerSchema = z.object({
  listingId: z.number().int().positive(),
  price: z.number().int().positive(),
  earnestMoney: z.number().int().min(0).optional(),
  financingType: z.enum(financingTypes).default("cash"),
  closingDays: z.number().int().min(1).max(365).default(30),
  contingencies: z.array(z.string()).max(10).default([]),
  proofOfFundsUrl: z.string().url().optional(),
  preApprovalUrl: z.string().url().optional(),
  message: z.string().max(5000).optional(),
});

restApp.post("/offers", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = offerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }
  const ownerId = await getListingOwnerId(parsed.data.listingId);
  if (!ownerId) return c.json({ error: "Listing not found" }, 404);
  if (ownerId === c.get("userId")) {
    return c.json({ error: "Cannot offer on your own listing" }, 400);
  }
  const offer = await createOffer({
    ...parsed.data,
    proofOfFundsUrl: parsed.data.proofOfFundsUrl ?? null,
    preApprovalUrl: parsed.data.preApprovalUrl ?? null,
    buyerId: c.get("userId"),
    status: "submitted",
  });
  void dispatchWebhookEvent([ownerId], "offer.created", offer);
  void createNotification(ownerId, {
    type: "offer_created",
    title: `New offer: $${offer.price.toLocaleString("en-US")}`,
    body: "Via API · open your dashboard to respond",
    link: "/dashboard",
  }).catch(() => {});
  return c.json(offer, 201);
});

// --- Deals ---
restApp.get("/deals", async (c) => {
  const rows = await listDealsForUser(c.get("userId"));
  return c.json({ items: rows });
});

// --- Foreclosures ---
restApp.get("/foreclosures", async (c) => {
  const q = c.req.query();
  const result = await searchForeclosures({
    county: q.county,
    state: q.state,
    recordType: q.recordType,
    limit: q.limit ? Math.min(Number(q.limit), 100) : 50,
    offset: q.offset ? Number(q.offset) : 0,
  });
  return c.json(result);
});

const openApiDoc = {
  openapi: "3.0.3",
  info: {
    title: "PropLink Public API",
    version: "1.0.0",
    description:
      "REST API for listings, offers, deal rooms and foreclosure records. Authenticate with `Authorization: Bearer plk_...`. Rate limit: 120 req/min per key.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/listings": {
      get: {
        summary: "Search listings",
        parameters: ["q", "city", "state", "propertyType", "minPrice", "maxPrice", "minBeds", "sort", "limit", "offset", "status"].map(
          (name) => ({ name, in: "query", schema: { type: "string" } }),
        ),
      },
      post: { summary: "Create a listing (validated like the web form)" },
    },
    "/listings/{id}": {
      get: { summary: "Get one listing" },
      patch: { summary: "Update your listing" },
      delete: { summary: "Delete your listing" },
    },
    "/offers": {
      get: {
        summary: "List offers",
        parameters: [
          { name: "box", in: "query", schema: { type: "string", enum: ["sent", "received"] } },
        ],
      },
      post: { summary: "Submit a structured offer" },
    },
    "/deals": { get: { summary: "List your deal rooms" } },
    "/foreclosures": {
      get: {
        summary: "Search foreclosure / pre-foreclosure records",
        parameters: ["county", "state", "recordType", "limit", "offset"].map(
          (name) => ({ name, in: "query", schema: { type: "string" } }),
        ),
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
};
