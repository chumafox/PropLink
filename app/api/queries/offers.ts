import { getDb } from "./connection";
import { offers, listings, users } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function createOffer(
  data: Omit<typeof offers.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const [{ id }] = await getDb().insert(offers).values(data).$returningId();
  const [row] = await getDb()
    .select()
    .from(offers)
    .where(eq(offers.id, id))
    .limit(1);
  return row;
}

export async function findOffersByBuyer(buyerId: number) {
  return getDb()
    .select({
      offer: offers,
      listingTitle: listings.title,
      listingCity: listings.city,
      listingState: listings.state,
      listingPrice: listings.price,
      listingPhotos: listings.photos,
    })
    .from(offers)
    .innerJoin(listings, eq(offers.listingId, listings.id))
    .where(eq(offers.buyerId, buyerId))
    .orderBy(desc(offers.createdAt));
}

export async function findOffersForOwner(ownerId: number) {
  return getDb()
    .select({
      offer: offers,
      listingTitle: listings.title,
      listingCity: listings.city,
      listingState: listings.state,
      buyerName: users.name,
      buyerAvatar: users.avatar,
    })
    .from(offers)
    .innerJoin(listings, eq(offers.listingId, listings.id))
    .leftJoin(users, eq(offers.buyerId, users.id))
    .where(eq(listings.ownerId, ownerId))
    .orderBy(desc(offers.createdAt));
}

export async function findOfferWithListing(offerId: number) {
  const [row] = await getDb()
    .select({ offer: offers, listing: listings })
    .from(offers)
    .innerJoin(listings, eq(offers.listingId, listings.id))
    .where(eq(offers.id, offerId))
    .limit(1);
  return row ?? null;
}

export async function respondToOffer(
  offerId: number,
  ownerId: number,
  response: {
    status: "accepted" | "declined" | "countered" | "under_review";
    counterPrice?: number;
    responseMessage?: string;
  },
) {
  const found = await findOfferWithListing(offerId);
  if (!found || found.listing.ownerId !== ownerId) return null;
  await getDb()
    .update(offers)
    .set({
      status: response.status,
      counterPrice: response.counterPrice ?? null,
      responseMessage: response.responseMessage ?? null,
      respondedAt: new Date(),
    })
    .where(eq(offers.id, offerId));
  const [row] = await getDb()
    .select()
    .from(offers)
    .where(eq(offers.id, offerId))
    .limit(1);
  return row;
}

export async function withdrawOffer(offerId: number, buyerId: number) {
  await getDb()
    .update(offers)
    .set({ status: "withdrawn" })
    .where(and(eq(offers.id, offerId), eq(offers.buyerId, buyerId)));
}

export async function countPendingOffersForOwner(ownerId: number) {
  const rows = await findOffersForOwner(ownerId);
  return rows.filter(
    (r) => r.offer.status === "submitted" || r.offer.status === "under_review",
  ).length;
}
