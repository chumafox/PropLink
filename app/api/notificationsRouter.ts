import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import {
  listNotifications,
  unreadNotificationCount,
  markAllRead,
  clearReadNotifications,
} from "./queries/notifications";
import {
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  getBuyBox,
  upsertBuyBox,
  matchesBuyBox,
} from "./queries/savedSearches";
import { getDb } from "./queries/connection";
import { listings, propertyTypes } from "@db/schema";
import { desc, eq } from "drizzle-orm";

const filtersSchema = z.object({
  q: z.string().max(200).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  propertyType: z.string().max(32).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  minBeds: z.number().int().min(0).optional(),
  minBaths: z.number().min(0).optional(),
});

export const notificationsRouter = createRouter({
  list: authedQuery.query(({ ctx }) => listNotifications(ctx.user.id)),
  unreadCount: authedQuery.query(({ ctx }) =>
    unreadNotificationCount(ctx.user.id),
  ),
  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    await markAllRead(ctx.user.id);
    return { ok: true };
  }),
  clearRead: authedQuery.mutation(async ({ ctx }) => {
    await clearReadNotifications(ctx.user.id);
    return { ok: true };
  }),

  // --- saved searches ---
  savedSearches: authedQuery.query(({ ctx }) =>
    listSavedSearches(ctx.user.id),
  ),
  createSavedSearch: authedQuery
    .input(z.object({ name: z.string().min(1).max(128), filters: filtersSchema }))
    .mutation(async ({ ctx, input }) => {
      await createSavedSearch(ctx.user.id, input.name, input.filters);
      return { ok: true };
    }),
  deleteSavedSearch: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSavedSearch(input.id, ctx.user.id);
      return { ok: true };
    }),

  // --- buy box ---
  buyBox: authedQuery.query(({ ctx }) => getBuyBox(ctx.user.id)),
  upsertBuyBox: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(128).default("My buy box"),
        states: z.array(z.string().max(64)).max(20).default([]),
        cities: z.array(z.string().max(128)).max(30).default([]),
        minPrice: z.number().int().min(0).optional(),
        maxPrice: z.number().int().min(0).optional(),
        propertyTypes: z.array(z.enum(propertyTypes)).max(10).default([]),
        minBeds: z.number().int().min(0).optional(),
        keywords: z.string().max(500).optional(),
        alertOn: z.number().int().min(0).max(1).default(1),
      }),
    )
    .mutation(({ ctx, input }) => upsertBuyBox(ctx.user.id, input)),

  // Listings matching my buy box right now
  buyBoxMatches: authedQuery.query(async ({ ctx }) => {
    const bb = await getBuyBox(ctx.user.id);
    if (!bb) return { buyBox: null, items: [] as (typeof listings.$inferSelect)[] };
    const rows = await getDb()
      .select()
      .from(listings)
      .where(eq(listings.status, "active"))
      .orderBy(desc(listings.createdAt))
      .limit(200);
    return {
      buyBox: bb,
      items: rows.filter((l) => l.ownerId !== ctx.user.id && matchesBuyBox(l, bb)),
    };
  }),
});

// --- verification (profile-related but admin procedures live here) ---
export const verificationRouter = createRouter({
  request: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const { profiles } = await import("@db/schema");
    const [p] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, ctx.user.id))
      .limit(1);
    if (!p?.licenseNumber) {
      throw new Error("Add your license number in your profile first");
    }
    await db
      .update(profiles)
      .set({ verificationStatus: "pending" })
      .where(eq(profiles.userId, ctx.user.id));
    return { ok: true };
  }),

  pending: adminQuery.query(async () => {
    const db = getDb();
    const { profiles, users } = await import("@db/schema");
    return db
      .select({
        profile: profiles,
        userName: users.name,
        userEmail: users.email,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(eq(profiles.verificationStatus, "pending"));
  }),

  decide: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        approve: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { profiles } = await import("@db/schema");
      await db
        .update(profiles)
        .set({
          verificationStatus: input.approve ? "verified" : "none",
        })
        .where(eq(profiles.userId, input.userId));
      return { ok: true };
    }),
});
