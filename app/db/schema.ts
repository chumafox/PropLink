import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  double,
  json,
  index,
} from "drizzle-orm/mysql-core";

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  // scrypt hash for email/password accounts (test/demo users without OAuth)
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", userRoles).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---- PropLink: professional profile (1:1 with users) ----

export const proRoles = [
  "buyer",
  "investor",
  "agent",
  "title_company",
  "private_lender",
  "hard_money_lender",
  "transaction_coordinator",
  "attorney",
  "gator_lender",
  "builder",
  "fix_flip",
  "contractor",
  "deal_participant",
] as const;
export type ProRole = (typeof proRoles)[number];

export const verificationStatuses = ["none", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const profiles = mysqlTable("profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  proRole: mysqlEnum("proRole", proRoles).notNull(),
  company: varchar("company", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  licenseNumber: varchar("licenseNumber", { length: 128 }),
  bio: text("bio"),
  marketsServed: varchar("marketsServed", { length: 255 }),
  verificationStatus: mysqlEnum("verificationStatus", verificationStatuses)
    .default("none")
    .notNull(),
  onboarded: int("onboarded").default(0).notNull(), // 0/1 — mysql tinyint via int
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export type Profile = typeof profiles.$inferSelect;

// ---- Listings ----

export const propertyTypes = [
  "house",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "apartment",
] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const listingStatuses = [
  "draft",
  "active",
  "pending",
  "sold",
  "archived",
] as const;
export type ListingStatus = (typeof listingStatuses)[number];

export const listings = mysqlTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    propertyType: mysqlEnum("propertyType", propertyTypes)
      .default("house")
      .notNull(),
    status: mysqlEnum("status", listingStatuses).default("active").notNull(),
    price: bigint("price", { mode: "number" }).notNull(), // USD, whole dollars
    addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
    city: varchar("city", { length: 128 }).notNull(),
    state: varchar("state", { length: 64 }).notNull(),
    zip: varchar("zip", { length: 16 }).notNull(),
    lat: double("lat"),
    lng: double("lng"),
    beds: int("beds").default(0).notNull(),
    baths: double("baths").default(0).notNull(),
    sqft: int("sqft").default(0).notNull(),
    lotSqft: int("lotSqft"),
    yearBuilt: int("yearBuilt"),
    photos: json("photos").$type<string[]>(),
    features: json("features").$type<string[]>(),
    batchData: json("batchData").$type<{
      estimatedEquity?: number;
      taxAmount?: number;
      mortgageBalance?: number;
      arv?: number;
      ownerName?: string;
      hash?: string;
    }>(),
    views: int("views").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    ownerIdx: index("listings_owner_idx").on(table.ownerId),
    statusIdx: index("listings_status_idx").on(table.status),
    cityIdx: index("listings_city_idx").on(table.city),
    priceIdx: index("listings_price_idx").on(table.price),
    statusCityPriceIdx: index("listings_status_city_price_idx").on(table.status, table.city, table.price),
  }),
);
export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

// ---- Offers (killer feature: structured offer delivery) ----

export const financingTypes = [
  "cash",
  "conventional",
  "fha",
  "va",
  "hard_money",
  "private_money",
  "other",
] as const;
export type FinancingType = (typeof financingTypes)[number];

export const offerStatuses = [
  "submitted",
  "under_review",
  "accepted",
  "countered",
  "declined",
  "withdrawn",
] as const;
export type OfferStatus = (typeof offerStatuses)[number];

export const offers = mysqlTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    listingId: bigint("listingId", { mode: "number", unsigned: true }).notNull().references(() => listings.id, { onDelete: "cascade" }),
    buyerId: bigint("buyerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    price: bigint("price", { mode: "number" }).notNull(),
    earnestMoney: bigint("earnestMoney", { mode: "number" }),
    financingType: mysqlEnum("financingType", financingTypes)
      .default("cash")
      .notNull(),
    closingDays: int("closingDays").default(30).notNull(),
    contingencies: json("contingencies").$type<string[]>(),
    proofOfFundsUrl: text("proofOfFundsUrl"),
    preApprovalUrl: text("preApprovalUrl"),
    message: text("message"),
    status: mysqlEnum("status", offerStatuses).default("submitted").notNull(),
    counterPrice: bigint("counterPrice", { mode: "number" }),
    responseMessage: text("responseMessage"),
    respondedAt: timestamp("respondedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    listingIdx: index("offers_listing_idx").on(table.listingId),
    buyerIdx: index("offers_buyer_idx").on(table.buyerId),
    statusIdx: index("offers_status_idx").on(table.status),
  }),
);
export type Offer = typeof offers.$inferSelect;

// ---- Bulk imports (CSV / JSON) ----

export const imports = mysqlTable("imports", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  format: mysqlEnum("format", ["csv", "json"]).notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  successRows: int("successRows").default(0).notNull(),
  failedRows: int("failedRows").default(0).notNull(),
  status: mysqlEnum("status", ["completed", "failed"])
    .default("completed")
    .notNull(),
  errors: json("errors").$type<{ row: number; message: string }[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Import = typeof imports.$inferSelect;

// ---- Phase 2: Messaging ----

export type Attachment = {
  url: string;
  name: string;
  kind: "image" | "document" | "audio";
};

export const conversations = mysqlTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    listingId: bigint("listingId", { mode: "number", unsigned: true }).references(() => listings.id, { onDelete: "set null" }),
    offerId: bigint("offerId", { mode: "number", unsigned: true }).references(() => offers.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 255 }),
    isGroup: int("isGroup").default(0).notNull(),
    pinnedFiles: json("pinnedFiles").$type<Attachment[]>(),
    // Omnichannel: "internal" = platform DM; otherwise bridged from an
    // external messenger (facebook / instagram / whatsapp / x)
    channel: mysqlEnum("channel", [
      "internal",
      "facebook",
      "instagram",
      "whatsapp",
      "x",
      "telegram",
    ])
      .default("internal")
      .notNull(),
    connectionId: bigint("connectionId", { mode: "number", unsigned: true }).references(() => channelConnections.id, { onDelete: "set null" }),
    // External thread identifier (PSID for Meta, phone for WhatsApp, …)
    externalThreadId: varchar("externalThreadId", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  },
  (table) => ({
    listingIdx: index("conv_listing_idx").on(table.listingId),
    offerIdx: index("conv_offer_idx").on(table.offerId),
    connIdx: index("conv_conn_idx").on(table.connectionId),
  }),
);
export type Conversation = typeof conversations.$inferSelect;

export const conversationParticipants = mysqlTable(
  "conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("lastReadAt"),
    notes: text("notes"),
    isPinned: int("isPinned").default(0).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
  },
  (table) => ({
    convIdx: index("cp_conv_idx").on(table.conversationId),
    userIdx: index("cp_user_idx").on(table.userId),
  }),
);
export type ConversationParticipant =
  typeof conversationParticipants.$inferSelect;

export const conversationTaskStatuses = ["todo", "in_progress", "done"] as const;
export type ConversationTaskStatus = (typeof conversationTaskStatuses)[number];

export const conversationTasks = mysqlTable(
  "conversation_tasks",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    status: mysqlEnum("status", conversationTaskStatuses).default("todo").notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("ctask_conv_idx").on(table.conversationId),
  })
);
export type ConversationTask = typeof conversationTasks.$inferSelect;

export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body"),
    attachments: json("attachments").$type<Attachment[]>(),
    // Cached translations: { "en": "...", "ru": "..." } — filled lazily on read
    translations: json("translations").$type<Record<string, string>>(),
    // External message id (dedupe for webhook redeliveries)
    externalId: varchar("externalId", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    convIdx: index("msg_conv_idx").on(table.conversationId),
    convCreatedAtIdx: index("msg_conv_created_idx").on(table.conversationId, table.createdAt),
  }),
);
export type Message = typeof messages.$inferSelect;

// ---- Phase 2: Deal Room ----

export const dealStatuses = [
  "open",
  "under_contract",
  "closing",
  "closed",
  "cancelled",
] as const;
export type DealStatus = (typeof dealStatuses)[number];

export const dealRooms = mysqlTable(
  "deal_rooms",
  {
    id: serial("id").primaryKey(),
    offerId: bigint("offerId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" })
      .unique(),
    listingId: bigint("listingId", { mode: "number", unsigned: true }).notNull().references(() => listings.id, { onDelete: "cascade" }),
    buyerId: bigint("buyerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    sellerId: bigint("sellerId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    conversationId: bigint("conversationId", {
      mode: "number",
      unsigned: true,
    }).references(() => conversations.id, { onDelete: "set null" }),
    status: mysqlEnum("status", dealStatuses).default("open").notNull(),
    targetClosingDate: varchar("targetClosingDate", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    buyerIdx: index("deal_buyer_idx").on(table.buyerId),
    sellerIdx: index("deal_seller_idx").on(table.sellerId),
  }),
);
export type DealRoom = typeof dealRooms.$inferSelect;

export const dealTasks = mysqlTable(
  "deal_tasks",
  {
    id: serial("id").primaryKey(),
    dealRoomId: bigint("dealRoomId", { mode: "number", unsigned: true })
      .notNull().references(() => dealRooms.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    assigneeRole: varchar("assigneeRole", { length: 64 }),
    done: int("done").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    dealIdx: index("task_deal_idx").on(table.dealRoomId),
  }),
);
export type DealTask = typeof dealTasks.$inferSelect;

export const dealDocuments = mysqlTable(
  "deal_documents",
  {
    id: serial("id").primaryKey(),
    dealRoomId: bigint("dealRoomId", { mode: "number", unsigned: true })
      .notNull().references(() => dealRooms.id, { onDelete: "cascade" }),
    uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true })
      .notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    version: int("version").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    dealIdx: index("doc_deal_idx").on(table.dealRoomId),
  }),
);
export type DealDocument = typeof dealDocuments.$inferSelect;

// ---- Phase 3: Public REST API ----

export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
    scopes: json("scopes").$type<string[]>(),
    lastUsedAt: timestamp("lastUsedAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("apikey_user_idx").on(table.userId),
  }),
);
export type ApiKey = typeof apiKeys.$inferSelect;

// ---- Phase 3: Webhooks ----

export const webhookEvents = [
  "listing.created",
  "listing.updated",
  "offer.created",
  "offer.status_changed",
  "deal.status_changed",
] as const;
export type WebhookEvent = (typeof webhookEvents)[number];

export const webhooks = mysqlTable(
  "webhooks",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: varchar("secret", { length: 128 }).notNull(),
    events: json("events").$type<string[]>(),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("webhook_user_idx").on(table.userId),
  }),
);
export type Webhook = typeof webhooks.$inferSelect;

export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: serial("id").primaryKey(),
    webhookId: bigint("webhookId", { mode: "number", unsigned: true })
      .notNull().references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 64 }).notNull(),
    payload: json("payload"),
    status: mysqlEnum("status", ["success", "failed"]).notNull(),
    responseCode: int("responseCode"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    hookIdx: index("delivery_hook_idx").on(table.webhookId),
  }),
);
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ---- Phase 3: Foreclosure records (county connectors) ----

export const foreclosureRecordTypes = [
  "lis_pendens",
  "notice_of_default",
  "notice_of_sale",
  "auction",
  "reo",
] as const;
export type ForeclosureRecordType = (typeof foreclosureRecordTypes)[number];

export const foreclosureRecords = mysqlTable(
  "foreclosure_records",
  {
    id: serial("id").primaryKey(),
    county: varchar("county", { length: 128 }).notNull(),
    state: varchar("state", { length: 64 }).notNull(),
    recordType: mysqlEnum("recordType", foreclosureRecordTypes).notNull(),
    caseNumber: varchar("caseNumber", { length: 128 }),
    sourceUrl: text("sourceUrl"),
    addressLine1: varchar("addressLine1", { length: 255 }).notNull(),
    city: varchar("city", { length: 128 }).notNull(),
    zip: varchar("zip", { length: 16 }),
    ownerName: varchar("ownerName", { length: 255 }),
    estimatedValue: bigint("estimatedValue", { mode: "number" }),
    openingBid: bigint("openingBid", { mode: "number" }),
    auctionDate: varchar("auctionDate", { length: 32 }),
    filingDate: varchar("filingDate", { length: 32 }),
    lat: double("lat"),
    lng: double("lng"),
    status: mysqlEnum("status", ["new", "matched", "archived"])
      .default("new")
      .notNull(),
    raw: json("raw"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    countyIdx: index("fc_county_idx").on(table.county),
    stateIdx: index("fc_state_idx").on(table.state),
    typeIdx: index("fc_type_idx").on(table.recordType),
  }),
);
export type ForeclosureRecord = typeof foreclosureRecords.$inferSelect;

// ---- Phase 3.5: user-managed county connectors ----

export const countyConnectors = mysqlTable(
  "county_connectors",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    county: varchar("county", { length: 128 }).notNull(),
    state: varchar("state", { length: 64 }).notNull(),
    sourceUrl: text("sourceUrl"),
    sourceType: mysqlEnum("sourceType", ["json_api", "html", "pdf", "spa"])
      .default("json_api")
      .notNull(),
    notes: varchar("notes", { length: 500 }),
    active: int("active").default(1).notNull(),
    lastSyncAt: timestamp("lastSyncAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("cc_user_idx").on(table.userId),
  }),
);
export type CountyConnectorRow = typeof countyConnectors.$inferSelect;

// ---- Phase 4: saved searches, notifications, buy boxes, verification ----

export const savedSearches = mysqlTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    filters: json("filters").$type<{
      q?: string;
      city?: string;
      state?: string;
      propertyType?: string;
      minPrice?: number;
      maxPrice?: number;
      minBeds?: number;
      minBaths?: number;
    }>(),
    alertOn: int("alertOn").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("ss_user_idx").on(table.userId),
  }),
);
export type SavedSearch = typeof savedSearches.$inferSelect;

export const notifications = mysqlTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: varchar("body", { length: 1000 }),
    link: varchar("link", { length: 500 }),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notif_user_idx").on(table.userId),
  }),
);
export type Notification = typeof notifications.$inferSelect;

export const buyBoxes = mysqlTable(
  "buy_boxes",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .unique(),
    name: varchar("name", { length: 128 }).default("My buy box").notNull(),
    states: json("states").$type<string[]>(),
    cities: json("cities").$type<string[]>(),
    minPrice: bigint("minPrice", { mode: "number" }),
    maxPrice: bigint("maxPrice", { mode: "number" }),
    propertyTypes: json("propertyTypes").$type<string[]>(),
    minBeds: int("minBeds"),
    keywords: varchar("keywords", { length: 500 }),
    alertOn: int("alertOn").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("bb_user_idx").on(table.userId),
  }),
);
export type BuyBox = typeof buyBoxes.$inferSelect;

// ---- AI Bot (BYOK translator) ----

export const aiProviders = [
  "openai",
  "anthropic",
  "moonshot",
  "deepseek",
  "openrouter",
  "ollama",
  "lmstudio",
  "custom",
] as const;
export type AiProvider = (typeof aiProviders)[number];

export const aiSettings = mysqlTable(
  "ai_settings",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .unique(),
    provider: mysqlEnum("provider", aiProviders).default("openai").notNull(),
    apiKey: varchar("apiKey", { length: 512 }),
    baseUrl: varchar("baseUrl", { length: 512 }),
    model: varchar("model", { length: 128 }),
    targetLanguage: varchar("targetLanguage", { length: 16 }).default("en"),
    autoTranslate: int("autoTranslate").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("ai_user_idx").on(table.userId),
  }),
);
export type AiSettings = typeof aiSettings.$inferSelect;

// ---- Omnichannel integrations (GHL-style unified inbox) ----

export const channelKinds = ["facebook", "instagram", "whatsapp", "x", "telegram"] as const;
export type ChannelKind = (typeof channelKinds)[number];

export const channelConnections = mysqlTable(
  "channel_connections",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: mysqlEnum("channel", channelKinds).notNull(),
    status: mysqlEnum("status", ["active", "error", "disconnected"])
      .default("active")
      .notNull(),
    // FB/IG: page or IG-business id. WhatsApp: phone_number_id. X: user id.
    externalAccountId: varchar("externalAccountId", { length: 255 }),
    externalAccountName: varchar("externalAccountName", { length: 255 }),
    // AES-256-GCM encrypted access token (page token / WA token / X bearer)
    accessTokenEnc: text("accessTokenEnc"),
    // Webhook verify token (user-chosen, for Meta webhook handshake)
    verifyToken: varchar("verifyToken", { length: 255 }),
    // App secret for X-Hub-Signature-256 validation (encrypted)
    appSecretEnc: text("appSecretEnc"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    lastEventAt: timestamp("lastEventAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("cc_user_idx").on(table.userId),
    extIdx: index("cc_ext_idx").on(table.externalAccountId),
  }),
);
export type ChannelConnection = typeof channelConnections.$inferSelect;

// ---- Hidden Messages ----
export const hiddenMessages = mysqlTable(
  "hidden_messages",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull().references(() => messages.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userMsgIdx: index("hm_user_msg_idx").on(table.userId, table.messageId),
  })
);
