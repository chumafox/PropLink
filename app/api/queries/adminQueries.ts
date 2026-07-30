import { getDb } from "./connection";
import {
  users,
  profiles,
  listings,
  offers,
  dealRooms,
  type UserRole,
  type VerificationStatus,
} from "@db/schema";
import { eq, sql, desc, like, or, and } from "drizzle-orm";

export async function getAdminMetrics() {
  const db = getDb();

  const [{ totalUsers }] = await db
    .select({ totalUsers: sql<number>`count(*)` })
    .from(users);

  const [{ totalVerified }] = await db
    .select({ totalVerified: sql<number>`count(*)` })
    .from(profiles)
    .where(eq(profiles.verificationStatus, "verified"));

  const [{ totalPendingVerification }] = await db
    .select({ totalPendingVerification: sql<number>`count(*)` })
    .from(profiles)
    .where(eq(profiles.verificationStatus, "pending"));

  const [{ totalListings }] = await db
    .select({ totalListings: sql<number>`count(*)` })
    .from(listings);

  const [{ activeListings }] = await db
    .select({ activeListings: sql<number>`count(*)` })
    .from(listings)
    .where(eq(listings.status, "active"));

  const [{ totalOffers }] = await db
    .select({ totalOffers: sql<number>`count(*)` })
    .from(offers);

  const [{ totalDeals }] = await db
    .select({ totalDeals: sql<number>`count(*)` })
    .from(dealRooms);

  return {
    totalUsers: Number(totalUsers),
    totalVerified: Number(totalVerified),
    totalPendingVerification: Number(totalPendingVerification),
    totalListings: Number(totalListings),
    activeListings: Number(activeListings),
    totalOffers: Number(totalOffers),
    totalDeals: Number(totalDeals),
  };
}

export async function listUsersAdmin(input: {
  q?: string;
  role?: UserRole;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const conds = [];
  if (input.role) {
    conds.push(eq(users.role, input.role));
  }
  if (input.q) {
    const pat = `%${input.q}%`;
    conds.push(or(like(users.name, pat), like(users.email, pat)));
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      banned: users.banned,
      avatar: users.avatar,
      createdAt: users.createdAt,
      proRole: profiles.proRole,
      company: profiles.company,
      phone: profiles.phone,
      licenseNumber: profiles.licenseNumber,
      verificationStatus: profiles.verificationStatus,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(conds.length ? and(...conds) : undefined);

  return { items: rows, total: Number(count) };
}

export async function setUserRoleAdmin(userId: number, role: UserRole) {
  const db = getDb();
  await db.update(users).set({ role }).where(eq(users.id, userId));
  const [updated] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return updated ?? null;
}

export async function toggleUserBanAdmin(userId: number, banned: number) {
  const db = getDb();
  await db.update(users).set({ banned }).where(eq(users.id, userId));
  return { id: userId, banned };
}

export async function deleteUserAdmin(userId: number) {
  const db = getDb();
  await db.delete(users).where(eq(users.id, userId));
  return { ok: true, deletedUserId: userId };
}

export async function setVerificationStatusAdmin(
  userId: number,
  verificationStatus: VerificationStatus,
) {
  const db = getDb();
  await db
    .update(profiles)
    .set({ verificationStatus })
    .where(eq(profiles.userId, userId));

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function listListingsAdmin(input: {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const conds = [];
  if (input.status) {
    conds.push(eq(listings.status, input.status as any));
  }
  if (input.q) {
    const pat = `%${input.q}%`;
    conds.push(
      or(
        like(listings.title, pat),
        like(listings.addressLine1, pat),
        like(listings.city, pat),
      ),
    );
  }

  const rows = await db
    .select()
    .from(listings)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(listings.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(conds.length ? and(...conds) : undefined);

  return { items: rows, total: Number(count) };
}

export async function setListingStatusAdmin(
  listingId: number,
  status: "draft" | "active" | "pending" | "sold" | "archived",
) {
  const db = getDb();
  await db
    .update(listings)
    .set({ status })
    .where(eq(listings.id, listingId));

  const [updated] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  return updated ?? null;
}
