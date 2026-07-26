import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import {
  searchListings,
  findListingById,
  incrementViews,
  findListingsByOwner,
  createListing,
  updateListing,
  updateBatchData,
  deleteListing,
} from "./queries/listings";
import { listingInputSchema } from "@contracts/listing";
import { propertyTypes, listingStatuses } from "@db/schema";
import { dispatchWebhookEvent } from "./queries/webhookQueries";
import { notifyListingMatches } from "./queries/savedSearches";

export const listingsRouter = createRouter({
  search: publicQuery
    .input(
      z
        .object({
          q: z.string().max(200).optional(),
          city: z.string().max(128).optional(),
          state: z.string().max(64).optional(),
          propertyType: z.enum(propertyTypes).optional(),
          minPrice: z.number().int().min(0).optional(),
          maxPrice: z.number().int().min(0).optional(),
          minBeds: z.number().int().min(0).optional(),
          minBaths: z.number().min(0).optional(),
          bounds: z
            .object({
              north: z.number(),
              south: z.number(),
              east: z.number(),
              west: z.number(),
            })
            .optional(),
          sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
          status: z.enum(listingStatuses).optional(),
        })
        .optional(),
    )
    .query(({ input }) => searchListings(input ?? {})),

  byId: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const row = await findListingById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      void incrementViews(input.id).catch(() => {});
      return row;
    }),

  mine: authedQuery.query(({ ctx }) => findListingsByOwner(ctx.user.id)),

  create: authedQuery
    .input(listingInputSchema)
    .mutation(async ({ ctx, input }) => {
      const listing = await createListing({ ...input, ownerId: ctx.user.id });
      void dispatchWebhookEvent([ctx.user.id], "listing.created", listing);
      void notifyListingMatches(listing).catch(() => {});
      return listing;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        data: listingInputSchema.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await updateListing(input.id, ctx.user.id, input.data);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  updateBatchData: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        batchData: listingInputSchema.shape.batchData,
      }),
    )
    .mutation(async ({ input }) => {
      // Intentionally omitting ownerId check so any participant can fetch/save data
      const row = await updateBatchData(input.id, input.batchData);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteListing(input.id, ctx.user.id);
      return { ok: true };
    }),
});
