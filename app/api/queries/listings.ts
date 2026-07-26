import { getDb } from "./connection";
import { listings, users, profiles, type Listing } from "@db/schema";
import {
  and,
  asc,
  between,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

export type ListingSearchInput = {
  q?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
  bounds?: { north: number; south: number; east: number; west: number };
  sort?: "newest" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
  status?: string;
};

export async function searchListings(input: ListingSearchInput) {
  const db = getDb();
  const conds: SQL[] = [eq(listings.status, (input.status as any) ?? "active")];

  if (input.q) {
    const pattern = `%${input.q}%`;
    conds.push(
      or(
        like(listings.title, pattern),
        like(listings.city, pattern),
        like(listings.addressLine1, pattern),
        like(listings.zip, pattern),
      )!,
    );
  }
  if (input.city) conds.push(like(listings.city, `%${input.city}%`));
  if (input.state) conds.push(eq(listings.state, input.state));
  if (input.propertyType)
    conds.push(eq(listings.propertyType, input.propertyType as any));
  if (input.minPrice != null) conds.push(gte(listings.price, input.minPrice));
  if (input.maxPrice != null) conds.push(lte(listings.price, input.maxPrice));
  if (input.minBeds != null) conds.push(gte(listings.beds, input.minBeds));
  if (input.minBaths != null) conds.push(gte(listings.baths, input.minBaths));
  if (input.bounds) {
    conds.push(between(listings.lat, input.bounds.south, input.bounds.north));
    conds.push(between(listings.lng, input.bounds.west, input.bounds.east));
  }

  const orderBy =
    input.sort === "price_asc"
      ? asc(listings.price)
      : input.sort === "price_desc"
        ? desc(listings.price)
        : desc(listings.createdAt);

  const rows = await db
    .select()
    .from(listings)
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(listings)
    .where(and(...conds));

  return { items: rows, total: Number(count) };
}

export async function findListingById(id: number) {
  const db = getDb();
  const [row] = await db
    .select({
      listing: listings,
      ownerName: users.name,
      ownerAvatar: users.avatar,
      ownerCompany: profiles.company,
      ownerPhone: profiles.phone,
      ownerRole: profiles.proRole,
      ownerVerified: profiles.verificationStatus,
    })
    .from(listings)
    .leftJoin(users, eq(listings.ownerId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(listings.id, id))
    .limit(1);
  return row ?? null;
}

export async function incrementViews(id: number) {
  await getDb()
    .update(listings)
    .set({ views: sql`${listings.views} + 1` })
    .where(eq(listings.id, id));
}

export async function findListingsByOwner(ownerId: number) {
  return getDb()
    .select()
    .from(listings)
    .where(eq(listings.ownerId, ownerId))
    .orderBy(desc(listings.createdAt));
}

export async function createListing(
  data: Omit<typeof listings.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const [{ id }] = await getDb().insert(listings).values(data).$returningId();
  const [row] = await getDb()
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return row;
}

export async function updateListing(
  id: number,
  ownerId: number,
  data: Partial<Listing>,
) {
  await getDb()
    .update(listings)
    .set(data as any)
    .where(and(eq(listings.id, id), eq(listings.ownerId, ownerId)));
  const [row] = await getDb()
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateBatchData(
  id: number,
  batchData: any,
) {
  await getDb()
    .update(listings)
    .set({ batchData })
    .where(eq(listings.id, id));
  
  const [row] = await getDb()
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteListing(id: number, ownerId: number) {
  await getDb()
    .delete(listings)
    .where(and(eq(listings.id, id), eq(listings.ownerId, ownerId)));
}

export async function getListingOwnerId(id: number) {
  const [row] = await getDb()
    .select({ ownerId: listings.ownerId })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  return row?.ownerId ?? null;
}
