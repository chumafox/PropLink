import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./queries/apikeys";
import {
  createWebhook,
  listWebhooks,
  deleteWebhookScoped,
  listDeliveries,
} from "./queries/webhookQueries";
import { webhookEvents } from "@db/schema";

export const developerRouter = createRouter({
  createKey: authedQuery
    .input(z.object({ name: z.string().min(1).max(128) }))
    .mutation(({ ctx, input }) => createApiKey(ctx.user.id, input.name)),

  keys: authedQuery.query(({ ctx }) => listApiKeys(ctx.user.id)),

  revokeKey: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await revokeApiKey(input.id, ctx.user.id);
      return { ok: true };
    }),

  createWebhook: authedQuery
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.enum(webhookEvents)).min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      createWebhook(ctx.user.id, input.url, input.events),
    ),

  webhooks: authedQuery.query(({ ctx }) => listWebhooks(ctx.user.id)),

  deleteWebhook: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteWebhookScoped(input.id, ctx.user.id);
      return { ok };
    }),

  deliveries: authedQuery
    .input(z.object({ webhookId: z.number().int().positive() }))
    .query(({ input }) => listDeliveries(input.webhookId)),
});
