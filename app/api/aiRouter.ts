import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  getAiSettings,
  upsertAiSettings,
  deleteAiSettings,
} from "./queries/aiSettings";
import { aiProviders } from "@db/schema";
import {
  maskApiKey,
  testConnection,
  resolveConfig,
} from "./ai/translate";

export const aiRouter = createRouter({
  getSettings: authedQuery.query(async ({ ctx }) => {
    const row = await getAiSettings(ctx.user.id);
    if (!row) return null;
    return {
      provider: row.provider,
      hasKey: Boolean(row.apiKey),
      maskedKey: maskApiKey(row.apiKey),
      baseUrl: row.baseUrl,
      model: row.model,
      targetLanguage: row.targetLanguage,
      autoTranslate: Boolean(row.autoTranslate),
      // Helpful resolved defaults so the UI can show effective config
      resolved: resolveConfig({
        provider: row.provider,
        baseUrl: row.baseUrl,
        model: row.model,
      }),
    };
  }),

  saveSettings: authedQuery
    .input(
      z.object({
        provider: z.enum(aiProviders),
        // undefined = keep existing key; empty string = clear key
        apiKey: z.string().max(512).optional(),
        baseUrl: z.string().max(512).optional().nullable(),
        model: z.string().max(128).optional().nullable(),
        targetLanguage: z.string().min(2).max(16).default("en"),
        autoTranslate: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey =
        input.apiKey === undefined
          ? undefined
          : input.apiKey.trim() === ""
            ? null
            : input.apiKey.trim();
      await upsertAiSettings(ctx.user.id, {
        provider: input.provider,
        apiKey,
        baseUrl: input.baseUrl?.trim() || null,
        model: input.model?.trim() || null,
        targetLanguage: input.targetLanguage.trim().toLowerCase(),
        autoTranslate: input.autoTranslate,
      });
      return { ok: true };
    }),

  deleteSettings: authedQuery.mutation(async ({ ctx }) => {
    await deleteAiSettings(ctx.user.id);
    return { ok: true };
  }),

  // Test with the *saved* settings (or a provided override for unsaved edits)
  testConnection: authedQuery
    .input(
      z
        .object({
          provider: z.enum(aiProviders).optional(),
          apiKey: z.string().max(512).optional(),
          baseUrl: z.string().max(512).optional().nullable(),
          model: z.string().max(128).optional().nullable(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await getAiSettings(ctx.user.id);
      const provider = input?.provider ?? saved?.provider;
      if (!provider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No AI provider configured yet",
        });
      }
      const cfg = {
        provider,
        apiKey: input?.apiKey?.trim() ? input.apiKey.trim() : saved?.apiKey,
        baseUrl:
          input?.baseUrl !== undefined && input?.baseUrl !== null
            ? input.baseUrl.trim() || null
            : (saved?.baseUrl ?? null),
        model:
          input?.model !== undefined && input?.model !== null
            ? input.model.trim() || null
            : (saved?.model ?? null),
      };
      try {
        const sample = await testConnection(
          cfg,
          saved?.targetLanguage ?? "en",
        );
        return { ok: true, sample };
      } catch (e: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e?.message ?? "Connection failed",
        });
      }
    }),

  getModels: authedQuery
    .input(
      z
        .object({
          provider: z.enum(aiProviders).optional(),
          apiKey: z.string().max(512).optional(),
          baseUrl: z.string().max(512).optional().nullable(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await getAiSettings(ctx.user.id);
      const provider = input?.provider ?? saved?.provider;
      if (!provider) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No AI provider configured",
        });
      }
      const cfg = {
        provider,
        apiKey: input?.apiKey?.trim() ? input.apiKey.trim() : saved?.apiKey,
        baseUrl:
          input?.baseUrl !== undefined && input?.baseUrl !== null
            ? input.baseUrl.trim() || null
            : (saved?.baseUrl ?? null),
      };
      try {
        const models = await import("./ai/translate").then((m) =>
          m.getModels(cfg),
        );
        return { ok: true, models };
      } catch (e: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e?.message ?? "Failed to fetch models",
        });
      }
    }),
});
