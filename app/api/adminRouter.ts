import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import {
  getAdminMetrics,
  listUsersAdmin,
  setUserRoleAdmin,
  setVerificationStatusAdmin,
  listListingsAdmin,
  setListingStatusAdmin,
} from "./queries/adminQueries";
import { userRoles, verificationStatuses, listingStatuses } from "@db/schema";

export const adminRouter = createRouter({
  getMetrics: adminQuery.query(async () => {
    return getAdminMetrics();
  }),

  listUsers: adminQuery
    .input(
      z
        .object({
          q: z.string().max(200).optional(),
          role: z.enum(userRoles).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return listUsersAdmin(input ?? {});
    }),

  setUserRole: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(userRoles),
      }),
    )
    .mutation(async ({ input }) => {
      return setUserRoleAdmin(input.userId, input.role);
    }),

  setVerificationStatus: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        verificationStatus: z.enum(verificationStatuses),
      }),
    )
    .mutation(async ({ input }) => {
      return setVerificationStatusAdmin(input.userId, input.verificationStatus);
    }),

  listListings: adminQuery
    .input(
      z
        .object({
          q: z.string().max(200).optional(),
          status: z.enum(listingStatuses).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return listListingsAdmin(input ?? {});
    }),

  setListingStatus: adminQuery
    .input(
      z.object({
        listingId: z.number().int().positive(),
        status: z.enum(listingStatuses),
      }),
    )
    .mutation(async ({ input }) => {
      return setListingStatusAdmin(input.listingId, input.status);
    }),
});
