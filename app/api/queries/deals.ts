import { getDb } from "./connection";
import {
  dealRooms,
  dealTasks,
  dealDocuments,
  offers,
  listings,
  users,
} from "@db/schema";
import { resolveFileUrl } from "../uploads";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { createConversation } from "./messaging";

const DEFAULT_TASKS: { title: string; assigneeRole: string }[] = [
  { title: "Signed purchase agreement", assigneeRole: "agent" },
  { title: "Earnest money deposited", assigneeRole: "buyer" },
  { title: "Title search & commitment", assigneeRole: "title_company" },
  { title: "Inspection completed", assigneeRole: "buyer" },
  { title: "Appraisal ordered", assigneeRole: "hard_money_lender" },
  { title: "Financing confirmed / proof of funds", assigneeRole: "buyer" },
  { title: "Closing documents prepared", assigneeRole: "transaction_coordinator" },
  { title: "Final walkthrough", assigneeRole: "agent" },
  { title: "Closing scheduled", assigneeRole: "title_company" },
];

export async function createDealRoomFromOffer(offerId: number) {
  const db = getDb();
  return await db.transaction(async (tx) => {
    // idempotent
    const [existing] = await tx
      .select()
      .from(dealRooms)
      .where(eq(dealRooms.offerId, offerId))
      .limit(1);
    if (existing) return existing;

    const [offerRow] = await tx
      .select()
      .from(offers)
      .where(eq(offers.id, offerId))
      .limit(1);
    if (!offerRow) throw new Error("offer not found");

    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, offerRow.listingId))
      .limit(1);
    if (!listing) throw new Error("listing not found");

    // Inline conversation creation to stay inside transaction
    const [{ id: convId }] = await tx
      .insert(conversations)
      .values({
        listingId: listing.id,
        offerId: offerRow.id,
        subject: `Deal: ${listing.title}`,
        isGroup: 0,
      })
      .$returningId();
      
    await tx.insert(conversationParticipants).values([
      { conversationId: convId, userId: offerRow.buyerId },
      { conversationId: convId, userId: listing.ownerId }
    ]);

    const [{ id }] = await tx
      .insert(dealRooms)
      .values({
        offerId: offerRow.id,
        listingId: listing.id,
        buyerId: offerRow.buyerId,
        sellerId: listing.ownerId,
        conversationId: convId,
        status: "open",
      })
      .$returningId();

    for (const t of DEFAULT_TASKS) {
      await tx.insert(dealTasks).values({ dealRoomId: id, ...t });
    }

    const [row] = await tx
      .select()
      .from(dealRooms)
      .where(eq(dealRooms.id, id))
      .limit(1);
    return row;
  });
}

export async function listDealsForUser(userId: number) {
  const db = getDb();
  const rows = await db
    .select({
      deal: dealRooms,
      offerPrice: offers.price,
      listingTitle: listings.title,
      listingCity: listings.city,
      listingState: listings.state,
      listingPhotos: listings.photos,
    })
    .from(dealRooms)
    .innerJoin(offers, eq(dealRooms.offerId, offers.id))
    .innerJoin(listings, eq(dealRooms.listingId, listings.id))
    .where(or(eq(dealRooms.buyerId, userId), eq(dealRooms.sellerId, userId)))
    .orderBy(desc(dealRooms.createdAt));

  const out = [];
  for (const r of rows) {
    const otherId =
      r.deal.buyerId === userId ? r.deal.sellerId : r.deal.buyerId;
    const [other] = await db
      .select({ name: users.name, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, otherId))
      .limit(1);
    const [{ taskCount }] = await db
      .select({ taskCount: sql<number>`count(*)` })
      .from(dealTasks)
      .where(eq(dealTasks.dealRoomId, r.deal.id));
    const [{ doneCount }] = await db
      .select({ doneCount: sql<number>`count(*)` })
      .from(dealTasks)
      .where(and(eq(dealTasks.dealRoomId, r.deal.id), eq(dealTasks.done, 1)));
    out.push({
      ...r,
      mySide: r.deal.buyerId === userId ? ("buyer" as const) : ("seller" as const),
      otherUser: other ?? null,
      taskCount: Number(taskCount),
      doneCount: Number(doneCount),
    });
  }
  return out;
}

export async function getDealRoom(id: number, userId: number) {
  const db = getDb();
  const [row] = await db
    .select({ deal: dealRooms, offer: offers, listing: listings })
    .from(dealRooms)
    .innerJoin(offers, eq(dealRooms.offerId, offers.id))
    .innerJoin(listings, eq(dealRooms.listingId, listings.id))
    .where(eq(dealRooms.id, id))
    .limit(1);
  if (!row) return null;
  if (row.deal.buyerId !== userId && row.deal.sellerId !== userId) return null;

  const [buyer] = await db
    .select({ id: users.id, name: users.name, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, row.deal.buyerId))
    .limit(1);
  const [seller] = await db
    .select({ id: users.id, name: users.name, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, row.deal.sellerId))
    .limit(1);

  const tasks = await db
    .select()
    .from(dealTasks)
    .where(eq(dealTasks.dealRoomId, id))
    .orderBy(dealTasks.createdAt);
  const documents = await db
    .select({
      doc: dealDocuments,
      uploaderName: users.name,
    })
    .from(dealDocuments)
    .innerJoin(users, eq(dealDocuments.uploadedBy, users.id))
    .where(eq(dealDocuments.dealRoomId, id))
    .orderBy(desc(dealDocuments.createdAt));

  // Resolve private s3:// document URLs into fresh presigned GET URLs
  for (const d of documents) {
    if (d.doc.url?.startsWith("s3://")) {
      d.doc.url = await resolveFileUrl(d.doc.url);
    }
  }

  return { ...row, buyer, seller, tasks, documents };
}

export async function addTask(dealRoomId: number, title: string, assigneeRole?: string) {
  await getDb()
    .insert(dealTasks)
    .values({ dealRoomId, title, assigneeRole: assigneeRole ?? null });
}

export async function toggleTask(taskId: number, dealRoomId: number) {
  const db = getDb();
  const [t] = await db
    .select()
    .from(dealTasks)
    .where(eq(dealTasks.id, taskId))
    .limit(1);
  if (!t || t.dealRoomId !== dealRoomId) return;
  await db
    .update(dealTasks)
    .set({ done: t.done ? 0 : 1 })
    .where(eq(dealTasks.id, taskId));
}

export async function addDocument(
  dealRoomId: number,
  uploadedBy: number,
  name: string,
  url: string,
) {
  const db = getDb();
  const [{ maxV }] = await db
    .select({ maxV: sql<number>`coalesce(max(version), 0)` })
    .from(dealDocuments)
    .where(
      and(eq(dealDocuments.dealRoomId, dealRoomId), eq(dealDocuments.name, name)),
    );
  await db
    .insert(dealDocuments)
    .values({ dealRoomId, uploadedBy, name, url, version: Number(maxV) + 1 });
}

export async function updateDealStatus(
  id: number,
  userId: number,
  status: (typeof dealRooms.$inferSelect)["status"],
) {
  const db = getDb();
  const [row] = await db.select().from(dealRooms).where(eq(dealRooms.id, id)).limit(1);
  if (!row || (row.buyerId !== userId && row.sellerId !== userId)) return null;
  await db.update(dealRooms).set({ status }).where(eq(dealRooms.id, id));
  return getDealRoom(id, userId);
}
