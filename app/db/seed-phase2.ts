import "dotenv/config";
import { getDb } from "../api/queries/connection";
import { listings, offers, conversations } from "./schema";
import { eq } from "drizzle-orm";
import {
  createConversation,
  sendMessage,
  isParticipant,
} from "../api/queries/messaging";
import { createDealRoomFromOffer } from "../api/queries/deals";

async function main() {
  const db = getDb();

  const agent = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.unionId, "demo-agent-proplink"),
  });
  const investor = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.unionId, "demo-investor-proplink"),
  });
  if (!agent || !investor) throw new Error("run db/seed.ts first");

  const ranch = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.addressLine1, "3309 Chisholm Valley Dr"),
  });
  if (!ranch) throw new Error("listing not found");

  let conv: typeof conversations.$inferSelect | undefined;
  const existingConvs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.listingId, ranch.id));
  for (const c of existingConvs) {
    if (
      (await isParticipant(c.id, agent.id)) &&
      (await isParticipant(c.id, investor.id))
    ) {
      conv = c;
      break;
    }
  }
  if (!conv) {
    conv = await createConversation([investor.id, agent.id], {
      listingId: ranch.id,
    });
    await sendMessage(
      conv.id,
      investor.id,
      "Hi Sarah — I just sent a cash offer on the Round Rock ranch. 14-day close, no contingencies. Happy to jump on a call.",
      [],
    );
    await sendMessage(
      conv.id,
      agent.id,
      "Hi Marcus, got it — the structured offer is very clear, thank you. Can you share proof of funds?",
      [],
    );
    await sendMessage(
      conv.id,
      investor.id,
      "Attached — bank letter from last week.",
      [
        {
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          name: "Proof of funds — Chen Capital.pdf",
          kind: "document",
        },
      ],
    );
    await sendMessage(
      conv.id,
      agent.id,
      "Received. The seller is reviewing tonight — I'll respond through the offer either way.",
      [],
    );
    console.log("demo conversation created");
  } else {
    console.log("demo conversation already exists");
  }

  const ybor = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.addressLine1, "1911 E 15th Ave"),
  });
  if (ybor) {
    const [offer] = await db
      .select()
      .from(offers)
      .where(eq(offers.listingId, ybor.id))
      .limit(1);
    if (offer) {
      if (offer.status !== "accepted") {
        await db
          .update(offers)
          .set({ status: "accepted", respondedAt: new Date() })
          .where(eq(offers.id, offer.id));
      }
      const room = await createDealRoomFromOffer(offer.id);
      console.log("deal room ready, id:", room.id);
    }
  }

  console.log("Phase 2 seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
