const fs = require('fs');

let schema = fs.readFileSync('app/db/schema.ts', 'utf8');

// Replacements
const reps = [
  ['email: varchar("email", { length: 320 }),', 'email: varchar("email", { length: 320 }).unique(),'],
  ['userId: bigint("userId", { mode: "number", unsigned: true })\n    .notNull()\n    .unique(),', 'userId: bigint("userId", { mode: "number", unsigned: true })\n    .notNull()\n    .references(() => users.id, { onDelete: "cascade" })\n    .unique(),'],
  ['ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),', 'ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['listingId: bigint("listingId", { mode: "number", unsigned: true }).notNull(),', 'listingId: bigint("listingId", { mode: "number", unsigned: true }).notNull().references(() => listings.id, { onDelete: "cascade" }),'],
  ['buyerId: bigint("buyerId", { mode: "number", unsigned: true }).notNull(),', 'buyerId: bigint("buyerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),', 'userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['listingId: bigint("listingId", { mode: "number", unsigned: true }),', 'listingId: bigint("listingId", { mode: "number", unsigned: true }).references(() => listings.id, { onDelete: "set null" }),'],
  ['offerId: bigint("offerId", { mode: "number", unsigned: true }),', 'offerId: bigint("offerId", { mode: "number", unsigned: true }).references(() => offers.id, { onDelete: "set null" }),'],
  ['connectionId: bigint("connectionId", { mode: "number", unsigned: true }),', 'connectionId: bigint("connectionId", { mode: "number", unsigned: true }).references(() => channelConnections.id, { onDelete: "set null" }),'],
  ['conversationId: bigint("conversationId", {\n      mode: "number",\n      unsigned: true,\n    }).notNull(),', 'conversationId: bigint("conversationId", {\n      mode: "number",\n      unsigned: true,\n    }).notNull().references(() => conversations.id, { onDelete: "cascade" }),'],
  ['conversationId: bigint("conversationId", {\n      mode: "number",\n      unsigned: true,\n    }),', 'conversationId: bigint("conversationId", {\n      mode: "number",\n      unsigned: true,\n    }).references(() => conversations.id, { onDelete: "set null" }),'],
  ['senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull(),', 'senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['offerId: bigint("offerId", { mode: "number", unsigned: true })\n      .notNull()\n      .unique(),', 'offerId: bigint("offerId", { mode: "number", unsigned: true })\n      .notNull()\n      .references(() => offers.id, { onDelete: "cascade" })\n      .unique(),'],
  ['sellerId: bigint("sellerId", { mode: "number", unsigned: true }).notNull(),', 'sellerId: bigint("sellerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['dealRoomId: bigint("dealRoomId", { mode: "number", unsigned: true })\n      .notNull(),', 'dealRoomId: bigint("dealRoomId", { mode: "number", unsigned: true })\n      .notNull().references(() => dealRooms.id, { onDelete: "cascade" }),'],
  ['uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true })\n      .notNull(),', 'uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true })\n      .notNull().references(() => users.id, { onDelete: "cascade" }),'],
  ['webhookId: bigint("webhookId", { mode: "number", unsigned: true })\n      .notNull(),', 'webhookId: bigint("webhookId", { mode: "number", unsigned: true })\n      .notNull().references(() => webhooks.id, { onDelete: "cascade" }),'],
  ['messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),', 'messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull().references(() => messages.id, { onDelete: "cascade" }),'],
];

for (const [find, replace] of reps) {
  schema = schema.replaceAll(find, replace);
}

// Add composite indexes
schema = schema.replace(
  'priceIdx: index("listings_price_idx").on(table.price),',
  'priceIdx: index("listings_price_idx").on(table.price),\n    statusCityPriceIdx: index("listings_status_city_price_idx").on(table.status, table.city, table.price),'
);

schema = schema.replace(
  'convIdx: index("msg_conv_idx").on(table.conversationId),',
  'convIdx: index("msg_conv_idx").on(table.conversationId),\n    convCreatedAtIdx: index("msg_conv_created_idx").on(table.conversationId, table.createdAt),'
);

fs.writeFileSync('app/db/schema.ts', schema);
console.log("Done");
