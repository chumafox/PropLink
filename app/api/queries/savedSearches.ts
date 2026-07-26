import { getDb } from "./connection";
import { savedSearches, buyBoxes, listings } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";
import { createNotification } from "./notifications";

function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

type Filters = {
  q?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  minBaths?: number;
};

type ListingRow = typeof listings.$inferSelect;

export async function listSavedSearches(userId: number) {
  return getDb()
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));
}

export async function createSavedSearch(
  userId: number,
  name: string,
  filters: Filters,
) {
  await getDb()
    .insert(savedSearches)
    .values({ userId, name, filters, alertOn: 1 });
}

export async function deleteSavedSearch(id: number, userId: number) {
  await getDb()
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
}

// --- buy box ---
export async function getBuyBox(userId: number) {
  const [row] = await getDb()
    .select()
    .from(buyBoxes)
    .where(eq(buyBoxes.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertBuyBox(
  userId: number,
  data: {
    name: string;
    states: string[];
    cities: string[];
    minPrice?: number;
    maxPrice?: number;
    propertyTypes: string[];
    minBeds?: number;
    keywords?: string;
    alertOn: number;
  },
) {
  await getDb()
    .insert(buyBoxes)
    .values({
      userId,
      ...data,
      minPrice: data.minPrice ?? null,
      maxPrice: data.maxPrice ?? null,
      minBeds: data.minBeds ?? null,
      keywords: data.keywords ?? null,
    })
    .onDuplicateKeyUpdate({ set: { ...data } });
  return getBuyBox(userId);
}

// --- matching ---
export function matchesFilters(l: ListingRow, f: Filters): boolean {
  if (f.state && l.state.toLowerCase() !== f.state.toLowerCase()) return false;
  if (f.city && !l.city.toLowerCase().includes(f.city.toLowerCase()))
    return false;
  if (f.propertyType && l.propertyType !== f.propertyType) return false;
  if (f.minPrice != null && l.price < f.minPrice) return false;
  if (f.maxPrice != null && l.price > f.maxPrice) return false;
  if (f.minBeds != null && l.beds < f.minBeds) return false;
  if (f.minBaths != null && l.baths < f.minBaths) return false;
  if (f.q) {
    const hay = `${l.title} ${l.addressLine1} ${l.city} ${l.zip}`.toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

export function matchesBuyBox(l: ListingRow, bb: typeof buyBoxes.$inferSelect): boolean {
  if (bb.states?.length && !bb.states.some((s) => s.toLowerCase() === l.state.toLowerCase()))
    return false;
  if (
    bb.cities?.length &&
    !bb.cities.some((c) => l.city.toLowerCase().includes(c.toLowerCase()))
  )
    return false;
  if (bb.propertyTypes?.length && !bb.propertyTypes.includes(l.propertyType))
    return false;
  if (bb.minPrice != null && l.price < bb.minPrice) return false;
  if (bb.maxPrice != null && l.price > bb.maxPrice) return false;
  if (bb.minBeds != null && l.beds < bb.minBeds) return false;
  if (bb.keywords) {
    const hay = `${l.title} ${l.description ?? ""}`.toLowerCase();
    const words = bb.keywords
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (words.length && !words.some((w) => hay.includes(w))) return false;
  }
  return true;
}

/**
 * Called after a listing is created: notifies owners of matching saved
 * searches and buy boxes (except the listing's own author).
 */
export async function notifyListingMatches(l: ListingRow) {
  const db = getDb();

  const searches = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.alertOn, 1));
  for (const s of searches) {
    if (s.userId === l.ownerId) continue;
    if (s.filters && matchesFilters(l, s.filters)) {
      await createNotification(s.userId, {
        type: "saved_search_match",
        title: `New match: ${l.title}`,
        body: `${formatPrice(l.price)} · ${l.city}, ${l.state} — matches your saved search "${s.name}"`,
        link: `/listings/${l.id}`,
      });
    }
  }

  const boxes = await db
    .select()
    .from(buyBoxes)
    .where(eq(buyBoxes.alertOn, 1));
  for (const bb of boxes) {
    if (bb.userId === l.ownerId) continue;
    if (matchesBuyBox(l, bb)) {
      await createNotification(bb.userId, {
        type: "buybox_match",
        title: `Buy box match: ${l.title}`,
        body: `${formatPrice(l.price)} · ${l.city}, ${l.state} fits your buy box`,
        link: `/listings/${l.id}`,
      });
    }
  }
}
