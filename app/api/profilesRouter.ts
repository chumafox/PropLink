import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { findProfileByUserId, upsertProfile } from "./queries/profiles";
import { proRoles } from "@db/schema";

export const profilesRouter = createRouter({
  me: authedQuery.query(({ ctx }) => findProfileByUserId(ctx.user.id)),

  upsert: authedQuery
    .input(
      z.object({
        proRole: z.enum(proRoles),
        company: z.string().max(255).optional(),
        phone: z.string().max(64).optional(),
        licenseNumber: z.string().max(128).optional(),
        bio: z.string().max(5000).optional(),
        marketsServed: z.string().max(255).optional(),
        onboarded: z.number().int().min(0).max(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) => upsertProfile(ctx.user.id, input)),
});
