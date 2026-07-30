import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { rateLimit } from "./lib/rateLimit";
import { findUserByEmail, upsertUser } from "./queries/users";
import { emailUnionId, hashPassword, verifyPassword } from "./emailAuth";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

function setSessionCookie(ctx: { req: Request; resHeaders: Headers }, token: string) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(4).max(128),
  name: z.string().min(1).max(255).optional(),
});

export const authRouter = createRouter({
  me: authedQuery.query((opts) => {
    const { passwordHash, ...safeUser } = opts.ctx.user;
    return safeUser;
  }),

  // Email/password — no email verification, for test & demo accounts.
  register: publicQuery
    .input(credentialsSchema)
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.headers.get("x-forwarded-for") || "unknown";
      rateLimit(`register:${ip}`, 5, 60_000); // 5 per min per IP
      const email = input.email.toLowerCase();
      const existing = await findUserByEmail(email);
      if (existing?.passwordHash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists — sign in instead",
        });
      }
      const passwordHash = await hashPassword(input.password);
      const unionId = emailUnionId(email);
      await upsertUser({
        unionId,
        name: input.name ?? email.split("@")[0],
        email,
        passwordHash,
        lastSignInAt: new Date(),
      });
      const token = await signSessionToken({ unionId, clientId: env.appId });
      setSessionCookie(ctx, token);
      return { ok: true };
    }),

  login: publicQuery
    .input(credentialsSchema.omit({ name: true }))
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.headers.get("x-forwarded-for") || "unknown";
      rateLimit(`login:${ip}`, 10, 60_000); // 10 per min per IP
      const email = input.email.toLowerCase();
      const user = await findUserByEmail(email);
      if (!user?.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      if (user.banned === 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account has been suspended by an administrator.",
        });
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
      await getDb()
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));
      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: env.appId,
      });
      setSessionCookie(ctx, token);
      return { ok: true };
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
