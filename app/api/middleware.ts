import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
const csrfGuard = t.middleware(async (opts) => {
  if (opts.type === "mutation") {
    const origin = opts.ctx.req.headers.get("origin");
    const host = opts.ctx.req.headers.get("host");
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host && !originUrl.host.includes("localhost") && !originUrl.host.includes("127.0.0.1")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "CSRF check failed" });
        }
      } catch {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid Origin" });
      }
    }
  }
  return opts.next();
});

export const publicQuery = t.procedure.use(csrfGuard);

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));
