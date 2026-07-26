import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import {
  createPresignedUpload,
  presignGet,
  publicFileUrl,
  uploadsConfigured,
  MAX_UPLOAD_BYTES,
} from "./uploads";

export const uploadsRouter = createRouter({
  // Frontend checks this to decide between file upload and paste-URL UI
  available: authedQuery.query(() => ({
    configured: uploadsConfigured(),
    maxBytes: MAX_UPLOAD_BYTES,
  })),

  // Presign a PUT upload. The client then PUTs the file directly to R2.
  presign: authedQuery
    .input(
      z.object({
        scope: z.enum(["public", "private"]),
        filename: z.string().min(1).max(255),
        contentType: z.string().min(3).max(128),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!uploadsConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "File storage is not configured yet — paste a file URL instead.",
        });
      }
      try {
        const { uploadUrl, key } = await createPresignedUpload({
          userId: ctx.user.id,
          scope: input.scope,
          filename: input.filename,
          contentType: input.contentType,
        });
        // What gets stored in the DB after the PUT succeeds:
        //  public → CDN/public URL (listing photos, SEO-safe)
        //  private → s3://key, resolved to a presigned GET on read
        const storedUrl =
          input.scope === "public" ? publicFileUrl(key) : `s3://${key}`;
        return { uploadUrl, key, storedUrl };
      } catch (e: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e?.message ?? "Could not create upload URL",
        });
      }
    }),

  // Fresh presigned GET for a private file (attachments stored as s3://key)
  fileUrl: authedQuery
    .input(z.object({ key: z.string().min(5).max(512) }))
    .query(async ({ input }) => {
      if (!uploadsConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED" });
      }
      return { url: await presignGet(input.key) };
    }),
});
