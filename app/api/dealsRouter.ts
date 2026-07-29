import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  listDealsForUser,
  getDealRoom,
  addTask,
  toggleTask,
  addDocument,
  updateDealStatus,
} from "./queries/deals";
import { dealStatuses } from "@db/schema";
import { dispatchWebhookEvent } from "./queries/webhookQueries";
import { createNotification } from "./queries/notifications";

async function requireDealAccess(id: number, userId: number) {
  const room = await getDealRoom(id, userId);
  if (!room) throw new TRPCError({ code: "FORBIDDEN" });
  return room;
}

export const dealsRouter = createRouter({
  list: authedQuery.query(({ ctx }) => listDealsForUser(ctx.user.id)),

  byId: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => requireDealAccess(input.id, ctx.user.id)),

  addTask: authedQuery
    .input(
      z.object({
        dealRoomId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        assigneeRole: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDealAccess(input.dealRoomId, ctx.user.id);
      await addTask(input.dealRoomId, input.title, input.assigneeRole);
      return getDealRoom(input.dealRoomId, ctx.user.id);
    }),

  toggleTask: authedQuery
    .input(
      z.object({
        dealRoomId: z.number().int().positive(),
        taskId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDealAccess(input.dealRoomId, ctx.user.id);
      await toggleTask(input.taskId, input.dealRoomId);
      return getDealRoom(input.dealRoomId, ctx.user.id);
    }),

  addDocument: authedQuery
    .input(
      z.object({
        dealRoomId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        url: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDealAccess(input.dealRoomId, ctx.user.id);
      await addDocument(
        input.dealRoomId,
        ctx.user.id,
        input.name,
        input.url,
      );
      return getDealRoom(input.dealRoomId, ctx.user.id);
    }),

  updateStatus: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(dealStatuses),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await updateDealStatus(input.id, ctx.user.id, input.status);
      if (!room) throw new TRPCError({ code: "FORBIDDEN" });
      void dispatchWebhookEvent(
        [room.deal.buyerId, room.deal.sellerId],
        "deal.status_changed",
        { dealRoomId: input.id, status: input.status },
      );
      const otherId =
        room.deal.buyerId === ctx.user.id ? room.deal.sellerId : room.deal.buyerId;
      void createNotification(otherId, {
        type: "deal_status",
        title: `Deal status: ${input.status.replace("_", " ")}`,
        body: room.listing.title ?? undefined,
        link: `/deals/${room.deal.id}`,
      }).catch(() => {});
      return room;
    }),
});
