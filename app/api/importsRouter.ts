import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { createImportRecord, findImportsByUser } from "./queries/imports";
import { createListing } from "./queries/listings";
import { listingInputSchema, coerceImportRow } from "@contracts/listing";
import { notifyListingMatches } from "./queries/savedSearches";

export const importsRouter = createRouter({
  // Client parses CSV/JSON into raw row objects; server validates each row,
  // inserts valid listings, and records per-row errors.
  create: authedQuery
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        format: z.enum(["csv", "json"]),
        rows: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const errors: { row: number; message: string }[] = [];
      let success = 0;

      for (let i = 0; i < input.rows.length; i++) {
        const coerced = coerceImportRow(input.rows[i]);
        const parsed = listingInputSchema.safeParse(coerced);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          errors.push({
            row: i + 1,
            message: `${issue.path.join(".") || "row"}: ${issue.message}`,
          });
          continue;
        }
        try {
          const created = await createListing({
            ...parsed.data,
            ownerId: ctx.user.id,
          });
          void notifyListingMatches(created).catch(() => {});
          success++;
        } catch (e) {
          errors.push({
            row: i + 1,
            message: e instanceof Error ? e.message : "insert failed",
          });
        }
      }

      const record = await createImportRecord({
        userId: ctx.user.id,
        filename: input.filename,
        format: input.format,
        totalRows: input.rows.length,
        successRows: success,
        failedRows: errors.length,
        status: errors.length === input.rows.length ? "failed" : "completed",
        errors: errors.slice(0, 500),
      });

      return record;
    }),

  list: authedQuery.query(({ ctx }) => findImportsByUser(ctx.user.id)),
});
