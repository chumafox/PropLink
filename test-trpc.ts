import 'dotenv/config';
import { db } from './app/db/index.js';
import { conversations, conversationParticipants } from './app/db/schema.js';
import { resolveFileUrl } from './app/api/uploads.js';
import { inArray, eq, and, desc, notInArray } from 'drizzle-orm';
import { messages } from './app/db/schema.js';
import { hiddenMessages } from './app/db/schema.js';

async function run() {
  try {
    const userId = 1;
    const userConvs = await db
      .select({
        id: conversations.id,
        listingId: conversations.listingId,
        isGroup: conversations.isGroup,
        groupName: conversations.groupName,
        createdAt: conversations.createdAt,
        pinnedFiles: conversations.pinnedFiles,
      })
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(eq(conversationParticipants.userId, userId))
      .orderBy(desc(conversations.createdAt));
      
    console.log("Raw userConvs count:", userConvs.length);
    for (let c of userConvs) {
      console.log("Conversation", c.id, "pinnedFiles type:", typeof c.pinnedFiles);
    }
    process.exit(0);
  } catch (err) {
    console.error("ERROR", err);
    process.exit(1);
  }
}
run();
