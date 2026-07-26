import { TRPCError } from "@trpc/server";

// Simple in-memory rate limiter
const store = new Map<string, { count: number; expiresAt: number }>();

export function rateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const record = store.get(key);

  if (record && record.expiresAt > now) {
    if (record.count >= maxRequests) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      });
    }
    record.count++;
  } else {
    store.set(key, { count: 1, expiresAt: now + windowMs });
  }

  // Cleanup expired entries periodically (optional simple cleanup)
  if (Math.random() < 0.05) {
    for (const [k, v] of store.entries()) {
      if (v.expiresAt <= now) {
        store.delete(k);
      }
    }
  }
}
