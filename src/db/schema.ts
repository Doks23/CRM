import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
  numeric,
  boolean,
  jsonb,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// Enums
// ────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "sales",
  "production",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "linkedin",
  "gmail_direct",
  "inquiry_form",
  "referral",
  "unknown",
]);

export const leadTypeEnum = pgEnum("lead_type", [
  "bulk",
  "retail",
  "inquiry",
  "partnership",
  "export",
  "sample_request",
  "spam",
]);

export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "needs_review",
  "qualified",
  "info_sent",
  "negotiation",
  "po_received",
  "dispatched",
  "won",
  "lost",
  "nurture",
]);

export const emailDirectionEnum = pgEnum("email_direction", [
  "inbound",
  "outbound",
]);

export const aiCategoryEnum = pgEnum("ai_category", [
  "relevant",
  "cold",
  "spam",
  "internal",
  "newsletter",
]);

export const languageEnum = pgEnum("language", ["en", "hi", "hinglish"]);

export const draftStatusEnum = pgEnum("draft_status", [
  "pending",
  "approved",
  "edited",
  "sent",
  "discarded",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "note_added",
  "stage_changed",
  "assigned",
  "email_sent",
  "draft_edited",
  "ai_classified",
  "follow_up_created",
  "follow_up_done",
]);

export const followUpStatusEnum = pgEnum("follow_up_status", [
  "pending",
  "done",
  "dismissed",
]);

export const followUpCreatorEnum = pgEnum("follow_up_creator", [
  "system",
  "user",
]);

export const llmProviderEnum = pgEnum("llm_provider", [
  "gemini",
  "openai",
  "ollama",
]);

// ────────────────────────────────────────────────────────────────────────────
// Auth.js tables (required by @auth/drizzle-adapter) + our extensions
// ────────────────────────────────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // App extensions
  role: userRoleEnum("role").notNull().default("sales"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ────────────────────────────────────────────────────────────────────────────
// Allowlist — who is allowed to sign in (managed by owner)
// ────────────────────────────────────────────────────────────────────────────

export const allowlist = pgTable("allowlist", {
  email: text("email").primaryKey(),
  role: userRoleEnum("role").notNull().default("sales"),
  invitedBy: text("invited_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Gmail account (single shared inbox in MVP — one row)
// ────────────────────────────────────────────────────────────────────────────

export const gmailAccount = pgTable("gmail_account", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  // OAuth tokens stored encrypted (AES-256-GCM) — ciphertext + iv + tag
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  encryptedAccessToken: text("encrypted_access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  lastHistoryId: text("last_history_id"),
  lastPolledAt: timestamp("last_polled_at", { mode: "date" }),
  connectedByUserId: text("connected_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Products (catalog for AI drafts)
// ────────────────────────────────────────────────────────────────────────────

export const products = pgTable("product", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  grade: text("grade"),
  packSize: text("pack_size"),
  moq: integer("moq"),
  priceRetail: numeric("price_retail", { precision: 12, scale: 2 }),
  priceWholesale: numeric("price_wholesale", { precision: 12, scale: 2 }),
  stockNote: text("stock_note"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Leads
// ────────────────────────────────────────────────────────────────────────────

export const leads = pgTable(
  "lead",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    primaryEmail: text("primary_email").notNull(),
    contactName: text("contact_name"),
    company: text("company"),
    phone: text("phone"),
    source: leadSourceEnum("source").notNull().default("unknown"),
    leadType: leadTypeEnum("lead_type").notNull().default("inquiry"),
    stage: leadStageEnum("stage").notNull().default("new"),
    score: integer("score").default(0),
    assignedUserId: text("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    aiSummary: text("ai_summary"),
    aiExtracted: jsonb("ai_extracted"),
    firstContactAt: timestamp("first_contact_at", { mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("lead_primary_email_unique").on(t.primaryEmail),
    index("lead_last_activity_idx").on(t.lastActivityAt),
    index("lead_stage_idx").on(t.stage),
    index("lead_assigned_idx").on(t.assignedUserId),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Email threads & messages
// ────────────────────────────────────────────────────────────────────────────

export const emailThreads = pgTable(
  "email_thread",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    gmailThreadId: text("gmail_thread_id").notNull().unique(),
    subject: text("subject"),
    lastMessageAt: timestamp("last_message_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("thread_lead_idx").on(t.leadId)],
);

export const emailMessages = pgTable(
  "email_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => emailThreads.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmail_message_id").notNull().unique(),
    direction: emailDirectionEnum("direction").notNull(),
    fromEmail: text("from_email"),
    toEmails: text("to_emails").array(),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull(),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    aiCategory: aiCategoryEnum("ai_category"),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
    aiReason: text("ai_reason"),
    detectedLanguage: languageEnum("detected_language"),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("message_thread_idx").on(t.threadId),
    index("message_received_idx").on(t.receivedAt),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// AI drafts
// ────────────────────────────────────────────────────────────────────────────

export const aiDrafts = pgTable(
  "ai_draft",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    inReplyToMessageId: uuid("in_reply_to_message_id").references(
      () => emailMessages.id,
      { onDelete: "set null" },
    ),
    draftBody: text("draft_body").notNull(),
    editedBody: text("edited_body"),
    language: languageEnum("language").notNull().default("en"),
    status: draftStatusEnum("status").notNull().default("pending"),
    gmailDraftId: text("gmail_draft_id"),
    sentMessageId: text("sent_message_id"),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    sentAt: timestamp("sent_at", { mode: "date" }),
    sentBy: text("sent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("draft_lead_idx").on(t.leadId),
    index("draft_status_idx").on(t.status),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Activities (audit log)
// ────────────────────────────────────────────────────────────────────────────

export const activities = pgTable(
  "activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: activityTypeEnum("type").notNull(),
    payload: jsonb("payload"),
    at: timestamp("at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_lead_idx").on(t.leadId),
    index("activity_at_idx").on(t.at),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Follow-ups
// ────────────────────────────────────────────────────────────────────────────

export const followUps = pgTable(
  "follow_up",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { mode: "date" }).notNull(),
    reason: text("reason"),
    status: followUpStatusEnum("status").notNull().default("pending"),
    createdBy: followUpCreatorEnum("created_by").notNull().default("system"),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("followup_lead_idx").on(t.leadId),
    index("followup_due_idx").on(t.dueAt),
    index("followup_status_idx").on(t.status),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Business profile (singleton — used by AI prompts)
// ────────────────────────────────────────────────────────────────────────────

export const businessProfile = pgTable("business_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyName: text("company_name"),
  gstin: text("gstin"),
  fssaiNumber: text("fssai_number"),
  certifications: text("certifications").array(),
  defaultTone: text("default_tone").default("warm-professional"),
  defaultCurrency: text("default_currency").default("INR"),
  pitchOneLiner: text("pitch_one_liner"),
  followUpInfoSentDays: integer("follow_up_info_sent_days").default(4),
  followUpNegotiationDays: integer("follow_up_negotiation_days").default(3),
  dailyAiCostCapInr: numeric("daily_ai_cost_cap_inr", {
    precision: 10,
    scale: 2,
  }).default("100.00"),
  classifierProvider: llmProviderEnum("classifier_provider")
    .notNull()
    .default("gemini"),
  classifierModel: text("classifier_model").notNull().default("gemini-2.5-flash"),
  drafterProvider: llmProviderEnum("drafter_provider")
    .notNull()
    .default("openai"),
  drafterModel: text("drafter_model").notNull().default("gpt-4o"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Relations
// ────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads, { relationName: "assignedLeads" }),
  ownedLeads: many(leads, { relationName: "ownedLeads" }),
  activities: many(activities),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [leads.assignedUserId],
    references: [users.id],
    relationName: "assignedLeads",
  }),
  ownerUser: one(users, {
    fields: [leads.ownerUserId],
    references: [users.id],
    relationName: "ownedLeads",
  }),
  threads: many(emailThreads),
  drafts: many(aiDrafts),
  activities: many(activities),
  followUps: many(followUps),
}));

export const emailThreadsRelations = relations(
  emailThreads,
  ({ one, many }) => ({
    lead: one(leads, {
      fields: [emailThreads.leadId],
      references: [leads.id],
    }),
    messages: many(emailMessages),
  }),
);

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  thread: one(emailThreads, {
    fields: [emailMessages.threadId],
    references: [emailThreads.id],
  }),
}));

export const aiDraftsRelations = relations(aiDrafts, ({ one }) => ({
  lead: one(leads, {
    fields: [aiDrafts.leadId],
    references: [leads.id],
  }),
  inReplyToMessage: one(emailMessages, {
    fields: [aiDrafts.inReplyToMessageId],
    references: [emailMessages.id],
  }),
  sentByUser: one(users, {
    fields: [aiDrafts.sentBy],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const followUpsRelations = relations(followUps, ({ one }) => ({
  lead: one(leads, {
    fields: [followUps.leadId],
    references: [leads.id],
  }),
}));

// Type helpers
export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type AiDraft = typeof aiDrafts.$inferSelect;
export type Product = typeof products.$inferSelect;
