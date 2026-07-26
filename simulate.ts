import 'dotenv/config';
import { db } from './app/db/index.js';
import { conversations, conversationParticipants, messages, users, listings } from './app/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  console.log("Starting simulation...");
  // 1. Get the users
  const allUsers = await db.select().from(users);
  const u1 = allUsers.find(u => u.email.includes('test'));
  const u2 = allUsers.find(u => u.email.includes('test2'));
  const u3 = allUsers.find(u => u.email.includes('test3'));
  
  if (!u1 || !u2) {
    console.log("Need at least two test users!");
    process.exit(1);
  }
  
  const listing = await db.select().from(listings).limit(1);
  const lId = listing[0]?.id || 1;

  // Create a new group chat
  const [convResult] = await db.insert(conversations).values({
    listingId: lId,
    isGroup: 1,
    groupName: "Simulation Group Chat",
    pinnedFiles: []
  });
  const convId = convResult.insertId;

  // Add participants
  await db.insert(conversationParticipants).values([
    { conversationId: convId, userId: u1.id },
    { conversationId: convId, userId: u2.id },
    ...(u3 ? [{ conversationId: convId, userId: u3.id }] : [])
  ]);

  // Insert some messages
  await db.insert(messages).values([
    { conversationId: convId, senderId: u1.id, body: "Hello everyone! I found this great property.", translatedBody: "Всем привет! Я нашел этот отличный объект." },
    { conversationId: convId, senderId: u2.id, body: "That looks amazing, let's check the tasks.", translatedBody: "Выглядит потрясающе, давайте проверим задачи." }
  ]);
  
  console.log("Simulation complete! Chat created with ID:", convId);
  process.exit(0);
}
run();
