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
import { fetchZillowPropertyByAddress } from "./lib/zillow";

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
    .mutation(async ({ ctx, input }) => {
      const row = await updateBatchData(input.id, ctx.user.id, input.batchData);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await deleteListing(input.id, ctx.user.id);
      return { ok: true };
    }),

  importFromZillow: authedQuery
    .input(z.object({ address: z.string().min(5) }))
    .mutation(async ({ input }) => {
      const details = await fetchZillowPropertyByAddress(input.address);
      
      // Extract photos
      const photos: string[] = [];
      const extractUrl = (p: any) => {
        if (typeof p === "string") return p;
        if (p?.url) return p.url;
        if (p?.mixedSources?.jpeg?.length) {
          // get the highest resolution (usually last in array) or just the first
          return p.mixedSources.jpeg[p.mixedSources.jpeg.length - 1].url;
        }
        return null;
      };

      if (details.originalPhotos && Array.isArray(details.originalPhotos)) {
        const urls = details.originalPhotos.map(extractUrl).filter(Boolean);
        photos.push(...urls);
      } else if (details.responsivePhotos && Array.isArray(details.responsivePhotos)) {
        const urls = details.responsivePhotos.map(extractUrl).filter(Boolean);
        photos.push(...urls);
      }
      
      return {
        description: details.description || "",
        price: details.price || details.zestimate || "",
        addressLine1: details.streetAddress || details.address?.streetAddress || "",
        city: details.city || details.address?.city || "",
        state: details.state || details.address?.state || "",
        zip: details.zipcode || details.address?.zipcode || "",
        lat: details.latitude,
        lng: details.longitude,
        beds: details.bedrooms,
        baths: details.bathrooms,
        sqft: details.livingArea,
        lotSqft: details.lotSize || details.resoFacts?.lotSize,
        yearBuilt: details.yearBuilt,
        photos: photos.slice(0, 40),
      };
    }),
});
