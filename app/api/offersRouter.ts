import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  createOffer,
  findOffersByBuyer,
  findOffersForOwner,
  respondToOffer,
  withdrawOffer,
} from "./queries/offers";
import { getListingOwnerId } from "./queries/listings";
import { createDealRoomFromOffer } from "./queries/deals";
import { dispatchWebhookEvent } from "./queries/webhookQueries";
import { createNotification } from "./queries/notifications";
import { financingTypes } from "@db/schema";

export const offersRouter = createRouter({
  create: authedQuery
    .input(
      z.object({
        listingId: z.number().int().positive(),
        price: z.number().int().positive(),
        earnestMoney: z.number().int().min(0).optional(),
        financingType: z.enum(financingTypes).default("cash"),
        closingDays: z.number().int().min(1).max(365).default(30),
        contingencies: z.array(z.string()).max(10).default([]),
        proofOfFundsUrl: z.string().url().optional().or(z.literal("")),
        preApprovalUrl: z.string().url().optional().or(z.literal("")),
        message: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = await getListingOwnerId(input.listingId);
      if (!ownerId) throw new TRPCError({ code: "NOT_FOUND" });
      if (ownerId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot make an offer on your own listing",
        });
      }
      const offer = await createOffer({
        ...input,
        proofOfFundsUrl: input.proofOfFundsUrl || null,
        preApprovalUrl: input.preApprovalUrl || null,
        buyerId: ctx.user.id,
        status: "submitted",
      });
      void dispatchWebhookEvent([ownerId], "offer.created", offer);
      void createNotification(ownerId, {
        type: "offer_created",
        title: `New offer: $${offer.price.toLocaleString("en-US")}`,
        body: `${offer.financingType.replace("_", " ")} · close in ${offer.closingDays} days — respond from your dashboard`,
        link: "/dashboard",
      }).catch(() => {});
      return offer;
    }),

  sent: authedQuery.query(({ ctx }) => findOffersByBuyer(ctx.user.id)),

  received: authedQuery.query(({ ctx }) => findOffersForOwner(ctx.user.id)),

  respond: authedQuery
    .input(
      z.object({
        offerId: z.number().int().positive(),
        status: z.enum(["accepted", "declined", "countered", "under_review"]),
        counterPrice: z.number().int().positive().optional(),
        responseMessage: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.status === "countered" && !input.counterPrice) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "counterPrice is required for a counter offer",
        });
      }
      const row = await respondToOffer(input.offerId, ctx.user.id, {
        status: input.status,
        counterPrice: input.counterPrice,
        responseMessage: input.responseMessage,
      });
      if (!row) throw new TRPCError({ code: "FORBIDDEN" });
      // Accepted offer → automatically spin up a Deal Room with a shared chat
      if (input.status === "accepted") {
        try {
          await createDealRoomFromOffer(row.id);
        } catch (err) {
          console.error(`Failed to create deal room for offer ${row.id}:`, err);
        }
      }
      void dispatchWebhookEvent([row.buyerId], "offer.status_changed", row);
      void createNotification(row.buyerId, {
        type: "offer_status",
        title:
          input.status === "accepted"
            ? "Your offer was accepted!"
            : input.status === "countered"
              ? `Counter offer: $${(input.counterPrice ?? 0).toLocaleString("en-US")}`
              : "Your offer was declined",
        body: input.responseMessage ?? undefined,
        link:
          input.status === "accepted" ? "/dashboard" : "/dashboard",
      }).catch(() => {});
      return row;
    }),

  withdraw: authedQuery
    .input(z.object({ offerId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await withdrawOffer(input.offerId, ctx.user.id);
      return { ok: true };
    }),
});
