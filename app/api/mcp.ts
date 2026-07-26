import type { Context } from "hono";
import { findKeyByToken, touchKey } from "./queries/apikeys";
import {
  searchListings,
  findListingById,
  createListing,
  updateListing,
  deleteListing,
  findListingsByOwner,
  getListingOwnerId,
} from "./queries/listings";
import {
  createOffer,
  findOffersByBuyer,
  findOffersForOwner,
  respondToOffer,
} from "./queries/offers";
import { listDealsForUser, getDealRoom } from "./queries/deals";
import {
  listConversationsForUser,
  sendMessage,
  isParticipant,
} from "./queries/messaging";
import { searchForeclosures } from "./queries/foreclosures";
import { findProfileByUserId, upsertProfile } from "./queries/profiles";
import { listingInputSchema } from "@contracts/listing";
import { proRoles } from "@db/schema";
import { dispatchWebhookEvent } from "./queries/webhookQueries";
import { notifyListingMatches } from "./queries/savedSearches";
import { createNotification } from "./queries/notifications";

// ---------------------------------------------------------------------------
// PropLink MCP server — Streamable HTTP, JSON-RPC 2.0, stateless.
// Auth: `Authorization: Bearer plk_...` (same keys as the REST API).
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const INSTRUCTIONS = `PropLink is a real-estate platform: agents list homes for free,
buyers/investors send structured offers that agents must answer, and accepted
offers open deal rooms with a shared chat, checklist and documents.
All tools operate on the authenticated user's own account (the API key owner).
Prices are whole US dollars. Use proplink_search_listings / proplink_get_listing
to read public inventory; use the offer tools to transact; profile tools manage
the user's public professional profile.`;

const listingProps: Json = {
  title: { type: "string", description: "Listing headline" },
  description: { type: "string" },
  propertyType: {
    type: "string",
    enum: ["house", "condo", "townhouse", "multi_family", "land", "apartment"],
  },
  status: { type: "string", enum: ["draft", "active", "pending", "sold", "archived"] },
  price: { type: "number", description: "Whole USD" },
  addressLine1: { type: "string" },
  city: { type: "string" },
  state: { type: "string" },
  zip: { type: "string" },
  lat: { type: "number" },
  lng: { type: "number" },
  beds: { type: "number" },
  baths: { type: "number" },
  sqft: { type: "number" },
  lotSqft: { type: "number" },
  yearBuilt: { type: "number" },
  photos: { type: "array", items: { type: "string" }, description: "Photo URLs" },
  features: { type: "array", items: { type: "string" } },
};

const tools: { name: string; description: string; inputSchema: Json }[] = [
  {
    name: "proplink_search_listings",
    description:
      "Search active real-estate listings on PropLink by text, city, state, type, price range and beds. Returns items + total.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Free text: title, address, city, ZIP" },
        city: { type: "string" },
        state: { type: "string", description: "e.g. TX" },
        propertyType: { type: "string", enum: ["house", "condo", "townhouse", "multi_family", "land", "apartment"] },
        minPrice: { type: "number" },
        maxPrice: { type: "number" },
        minBeds: { type: "number" },
        sort: { type: "string", enum: ["newest", "price_asc", "price_desc"] },
        limit: { type: "number", description: "1–100, default 25" },
        offset: { type: "number" },
      },
    },
  },
  {
    name: "proplink_get_listing",
    description: "Get full details of one listing by id, including owner/agent info.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "proplink_list_my_listings",
    description: "List all listings owned by the authenticated user.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "proplink_create_listing",
    description:
      "Publish a new listing on behalf of the authenticated user. Fires listing.created webhooks and alerts matching saved searches / buy boxes.",
    inputSchema: {
      type: "object",
      properties: listingProps,
      required: ["title", "price", "addressLine1", "city", "state", "zip"],
    },
  },
  {
    name: "proplink_update_listing",
    description: "Update fields of a listing owned by the authenticated user.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, ...listingProps },
      required: ["id"],
    },
  },
  {
    name: "proplink_delete_listing",
    description: "Delete a listing owned by the authenticated user.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "proplink_make_offer",
    description:
      "Submit a structured offer on a listing. The listing agent is notified and must accept, counter or decline.",
    inputSchema: {
      type: "object",
      properties: {
        listingId: { type: "number" },
        price: { type: "number" },
        earnestMoney: { type: "number" },
        financingType: {
          type: "string",
          enum: ["cash", "conventional", "fha", "va", "hard_money", "private_money", "other"],
        },
        closingDays: { type: "number" },
        contingencies: { type: "array", items: { type: "string" } },
        proofOfFundsUrl: { type: "string" },
        preApprovalUrl: { type: "string" },
        message: { type: "string" },
      },
      required: ["listingId", "price"],
    },
  },
  {
    name: "proplink_list_offers",
    description: "List offers sent by the user or received on the user's listings.",
    inputSchema: {
      type: "object",
      properties: { box: { type: "string", enum: ["sent", "received"] } },
    },
  },
  {
    name: "proplink_respond_offer",
    description:
      "Respond to a received offer: accept (opens a deal room automatically), counter (requires counterPrice) or decline.",
    inputSchema: {
      type: "object",
      properties: {
        offerId: { type: "number" },
        status: { type: "string", enum: ["accepted", "countered", "declined", "under_review"] },
        counterPrice: { type: "number" },
        responseMessage: { type: "string" },
      },
      required: ["offerId", "status"],
    },
  },
  {
    name: "proplink_list_deals",
    description: "List deal rooms the user participates in (buyer or seller side).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "proplink_get_deal",
    description: "Get a deal room: parties, checklist tasks, documents, status.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
  },
  {
    name: "proplink_list_conversations",
    description: "List the user's message conversations with unread counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "proplink_send_message",
    description: "Send a message in a conversation the user participates in.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "number" },
        body: { type: "string" },
      },
      required: ["conversationId", "body"],
    },
  },
  {
    name: "proplink_search_foreclosures",
    description:
      "Search foreclosure / pre-foreclosure records (lis pendens, NOD, notice of sale, auction, REO) by county, state and record type.",
    inputSchema: {
      type: "object",
      properties: {
        county: { type: "string" },
        state: { type: "string" },
        recordType: {
          type: "string",
          enum: ["lis_pendens", "notice_of_default", "notice_of_sale", "auction", "reo"],
        },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "proplink_get_profile",
    description: "Get the authenticated user's professional profile (role, company, license, verification status).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "proplink_update_profile",
    description:
      "Create or update the user's professional profile: role (agent, investor, title_company, lenders, attorney, etc.), company, phone, license number, markets, bio.",
    inputSchema: {
      type: "object",
      properties: {
        proRole: { type: "string", enum: [...proRoles] },
        company: { type: "string" },
        phone: { type: "string" },
        licenseNumber: { type: "string" },
        marketsServed: { type: "string" },
        bio: { type: "string" },
      },
      required: ["proRole"],
    },
  },
];

async function callTool(
  name: string,
  args: Json,
  userId: number,
): Promise<unknown> {
  switch (name) {
    case "proplink_search_listings":
      return searchListings({
        q: args.q as string,
        city: args.city as string,
        state: args.state as string,
        propertyType: args.propertyType as string,
        minPrice: args.minPrice as number,
        maxPrice: args.maxPrice as number,
        minBeds: args.minBeds as number,
        sort: (args.sort as any) ?? "newest",
        limit: Math.min(Number(args.limit ?? 25), 100),
        offset: (args.offset as number) ?? 0,
      });

    case "proplink_get_listing": {
      const row = await findListingById(Number(args.id));
      if (!row) throw new Error("Listing not found");
      return row;
    }

    case "proplink_list_my_listings":
      return findListingsByOwner(userId);

    case "proplink_create_listing": {
      const parsed = listingInputSchema.safeParse(args);
      if (!parsed.success) {
        throw new Error(
          `Validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
      const listing = await createListing({ ...parsed.data, ownerId: userId });
      void dispatchWebhookEvent([userId], "listing.created", listing);
      void notifyListingMatches(listing).catch(() => {});
      return listing;
    }

    case "proplink_update_listing": {
      const { id, ...rest } = args;
      const parsed = listingInputSchema.partial().safeParse(rest);
      if (!parsed.success) throw new Error("Validation failed");
      const row = await updateListing(Number(id), userId, parsed.data);
      if (!row) throw new Error("Not found or not yours");
      return row;
    }

    case "proplink_delete_listing":
      await deleteListing(Number(args.id), userId);
      return { ok: true };

    case "proplink_make_offer": {
      const listingId = Number(args.listingId);
      const ownerId = await getListingOwnerId(listingId);
      if (!ownerId) throw new Error("Listing not found");
      if (ownerId === userId) throw new Error("Cannot offer on your own listing");
      const offer = await createOffer({
        listingId,
        price: Number(args.price),
        earnestMoney: args.earnestMoney ? Number(args.earnestMoney) : null,
        financingType: (args.financingType as any) ?? "cash",
        closingDays: Number(args.closingDays ?? 30),
        contingencies: (args.contingencies as string[]) ?? [],
        proofOfFundsUrl: (args.proofOfFundsUrl as string) || null,
        preApprovalUrl: (args.preApprovalUrl as string) || null,
        message: (args.message as string) || null,
        buyerId: userId,
        status: "submitted",
      });
      void dispatchWebhookEvent([ownerId], "offer.created", offer);
      void createNotification(ownerId, {
        type: "offer_created",
        title: `New offer: $${offer.price.toLocaleString("en-US")}`,
        body: "Via MCP agent · respond from your dashboard",
        link: "/dashboard",
      }).catch(() => {});
      return offer;
    }

    case "proplink_list_offers":
      return args.box === "received"
        ? findOffersForOwner(userId)
        : findOffersByBuyer(userId);

    case "proplink_respond_offer": {
      const status = args.status as "accepted" | "declined" | "countered" | "under_review";
      if (status === "countered" && !args.counterPrice) {
        throw new Error("counterPrice required for a counter offer");
      }
      const row = await respondToOffer(Number(args.offerId), userId, {
        status,
        counterPrice: args.counterPrice ? Number(args.counterPrice) : undefined,
        responseMessage: args.responseMessage as string,
      });
      if (!row) throw new Error("Offer not found or not yours");
      if (status === "accepted") {
        const { createDealRoomFromOffer } = await import("./queries/deals");
        void createDealRoomFromOffer(row.id).catch(() => {});
      }
      void dispatchWebhookEvent([row.buyerId], "offer.status_changed", row);
      return row;
    }

    case "proplink_list_deals":
      return listDealsForUser(userId);

    case "proplink_get_deal": {
      const room = await getDealRoom(Number(args.id), userId);
      if (!room) throw new Error("Deal room not found or no access");
      return room;
    }

    case "proplink_list_conversations":
      return listConversationsForUser(userId);

    case "proplink_send_message": {
      const convId = Number(args.conversationId);
      if (!(await isParticipant(convId, userId))) {
        throw new Error("Not a participant of this conversation");
      }
      return sendMessage(convId, userId, String(args.body ?? "").trim(), []);
    }

    case "proplink_search_foreclosures":
      return searchForeclosures({
        county: args.county as string,
        state: args.state as string,
        recordType: args.recordType as string,
        limit: Math.min(Number(args.limit ?? 50), 100),
      });

    case "proplink_get_profile":
      return findProfileByUserId(userId);

    case "proplink_update_profile": {
      return upsertProfile(userId, {
        proRole: args.proRole as any,
        company: args.company as string,
        phone: args.phone as string,
        licenseNumber: args.licenseNumber as string,
        marketsServed: args.marketsServed as string,
        bio: args.bio as string,
        onboarded: 1,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function mcpHandler(c: Context) {
  if (c.req.method !== "POST") {
    // Discovery via GET — agents can learn what's here
    return c.json({
      name: "proplink",
      version: "1.0.0",
      description: INSTRUCTIONS,
      protocol: "MCP over Streamable HTTP (JSON-RPC 2.0 POST)",
      auth: "Authorization: Bearer plk_... (Dashboard → API & Webhooks)",
      tools: tools.map((t) => t.name),
    });
  }

  // Auth (required for tools/call; discovery methods are open)
  const header = c.req.header("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  let userId: number | null = null;
  if (token) {
    const key = await findKeyByToken(token);
    if (key) {
      userId = key.userId;
      void touchKey(key.id).catch(() => {});
    }
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error"), 400);
  }

  const { id, method, params } = body ?? {};

  switch (method) {
    case "initialize":
      return c.json(
        rpcResult(id, {
          protocolVersion: params?.protocolVersion ?? "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "proplink", version: "1.0.0" },
          instructions: INSTRUCTIONS,
        }),
      );

    case "notifications/initialized":
    case "initialized":
      return c.body(null, 202);

    case "ping":
      return c.json(rpcResult(id, {}));

    case "tools/list":
      return c.json(rpcResult(id, { tools }));

    case "tools/call": {
      if (!userId) {
        return c.json(
          rpcError(id, -32001, "Authentication required: Bearer plk_... API key"),
          200,
        );
      }
      const toolName = params?.name as string;
      const args = (params?.arguments ?? {}) as Json;
      if (!tools.some((t) => t.name === toolName)) {
        return c.json(rpcError(id, -32602, `Unknown tool: ${toolName}`));
      }
      try {
        const result = await callTool(toolName, args, userId);
        return c.json(
          rpcResult(id, {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) },
            ],
          }),
        );
      } catch (e) {
        return c.json(
          rpcResult(id, {
            content: [
              {
                type: "text",
                text: `Error: ${e instanceof Error ? e.message : "unknown"}`,
              },
            ],
            isError: true,
          }),
        );
      }
    }

    default:
      return c.json(rpcError(id ?? null, -32601, `Method not found: ${method}`), 200);
  }
}
