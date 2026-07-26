import { z } from "zod";
import { randomBytes } from "crypto";
import { createRouter, authedQuery } from "./middleware";
import {
  addConnection,
  listConnections,
  removeConnection,
} from "./queries/channels";

export const channelsRouter = createRouter({
  // List my connected channels (secrets never leave the server)
  list: authedQuery.query(async ({ ctx }) => {
    const rows = await listConnections(ctx.user.id);
    return rows
      .filter((r) => r.status !== "disconnected")
      .map((r) => ({
        id: r.id,
        channel: r.channel,
        status: r.status,
        externalAccountId: r.externalAccountId,
        externalAccountName: r.externalAccountName,
        hasToken: Boolean(r.accessTokenEnc),
        verifyToken: r.verifyToken,
        lastEventAt: r.lastEventAt,
        createdAt: r.createdAt,
      }));
  }),

  // Connect Facebook Page or Instagram Business account
  connectMeta: authedQuery
    .input(
      z.object({
        channel: z.enum(["facebook", "instagram"]),
        externalAccountId: z.string().min(3).max(255), // Page ID / IG business ID
        externalAccountName: z.string().max(255).optional(),
        accessToken: z.string().min(10).max(2048), // Page access token
        appSecret: z.string().max(2048).optional(), // Meta app secret
        verifyToken: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const verifyToken =
        input.verifyToken?.trim() ||
        `plk_${randomBytes(12).toString("hex")}`;
      const id = await addConnection(ctx.user.id, {
        channel: input.channel,
        externalAccountId: input.externalAccountId.trim(),
        externalAccountName: input.externalAccountName ?? null,
        accessToken: input.accessToken,
        appSecret: input.appSecret ?? null,
        verifyToken,
      });
      return { id, verifyToken };
    }),

  // Connect WhatsApp Business Cloud API
  connectWhatsApp: authedQuery
    .input(
      z.object({
        phoneNumberId: z.string().min(3).max(255),
        displayName: z.string().max(255).optional(),
        accessToken: z.string().min(10).max(2048),
        appSecret: z.string().max(2048).optional(),
        verifyToken: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const verifyToken =
        input.verifyToken?.trim() ||
        `plk_${randomBytes(12).toString("hex")}`;
      const id = await addConnection(ctx.user.id, {
        channel: "whatsapp",
        externalAccountId: input.phoneNumberId.trim(),
        externalAccountName: input.displayName ?? null,
        accessToken: input.accessToken,
        appSecret: input.appSecret ?? null,
        verifyToken,
        metadata: { messagingProduct: "whatsapp" },
      });
      return { id, verifyToken };
    }),

  // Connect X (Twitter) — requires paid X API tier
  connectX: authedQuery
    .input(
      z.object({
        xUserId: z.string().min(2).max(255), // numeric X user id
        username: z.string().max(255).optional(),
        accessToken: z.string().min(10).max(4096), // OAuth2 user-context token
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await addConnection(ctx.user.id, {
        channel: "x",
        externalAccountId: input.xUserId.trim(),
        externalAccountName: input.username
          ? `@${input.username.replace(/^@/, "")}`
          : null,
        accessToken: input.accessToken,
      });
      return { id };
    }),

  disconnect: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await removeConnection(ctx.user.id, input.id);
      return { ok: true };
    }),
});
