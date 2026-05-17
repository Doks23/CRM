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
import { relations, sql } from "drizzle-orm";

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
  "po",
  "dispatched",
  "won",
  "lost",
  "ignored",
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
  hash: text("hash"),
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
// Gmail account (single shared inbox — one row)
// ────────────────────────────────────────────────────────────────────────────

export const gmailAccount = pgTable("gmail_account", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  encryptedAccessToken: text("encrypted_access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  lastHistoryId: text("last_history_id"),
  lastPolledAt: timestamp("last_polled_at", { mode: "date" }),
  // Connection-health fields. Cleared on every successful poll; populated on
  // any error so the Settings card can show a red banner instead of failing
  // silently. `last_error_kind` is a coarse bucket the UI uses to decide
  // whether to suggest "reconnect" vs "wait for rate limit to clear".
  lastErrorKind: text("last_error_kind"), // "auth" | "rate_limit" | "transient" | null
  lastErrorMessage: text("last_error_message"),
  lastErrorAt: timestamp("last_error_at", { mode: "date" }),
  lastSuccessAt: timestamp("last_success_at", { mode: "date" }),
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
    leadCode: text("lead_code").unique().notNull(),
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
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    aiSummary: text("ai_summary"),
    aiExtracted: jsonb("ai_extracted"),
    // Owner/sales-editable freeform memory shown to the AI on every draft.
    // The single most-leverage field for personalisation. Example:
    //   "Distributor in Lucknow. Asked for 4-suta last month. Pays 50% advance."
    notesForAi: text("notes_for_ai"),
    firstContactAt: timestamp("first_contact_at", { mode: "date" }),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    /** Set by the repeat-order cron so we don't pester a lead daily. */
    lastReorderNudgeAt: timestamp("last_reorder_nudge_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_last_activity_idx").on(t.lastActivityAt),
    index("lead_stage_idx").on(t.stage),
    index("lead_assigned_idx").on(t.assignedUserId),
    index("lead_deleted_at_idx").on(t.deletedAt),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Email messages (thread grouping via gmail_thread_id)
// ────────────────────────────────────────────────────────────────────────────

export const emailMessages = pgTable(
  "email_message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    gmailThreadId: text("gmail_thread_id").notNull(),
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
    index("message_thread_idx").on(t.gmailThreadId),
    index("message_received_idx").on(t.receivedAt),
    index("message_lead_idx").on(t.leadId),
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
    /** Client-generated UUID for the most recent send attempt. Used to
     *  deduplicate retries — if a retry arrives with the same key after a
     *  partial failure, we won't create a second Gmail draft. */
    clientSendKey: text("client_send_key"),
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
    // Postgres allows many NULLs in a unique column — exactly the semantic
    // we want (drafts that haven't been sent yet have no key).
    unique("draft_client_send_key_unique").on(t.clientSendKey),
  ],
);

// ────────────────────────────────────────────────────────────────────────────
// Business profile (singleton — used by AI prompts + allowlist)
// ────────────────────────────────────────────────────────────────────────────

export type AllowedEmail = {
  email: string;
  role: "owner" | "sales" | "production";
};

/**
 * Calendar dates the system should auto-draft greetings on. Each entry is an
 * MM-DD pair (year-agnostic) plus a human label used in the greeting.
 *   { date: "11-01", label: "Diwali" }
 * The cron fires on the morning of that date once a year.
 */
export type FestiveDate = {
  /** "MM-DD" — year-agnostic */
  date: string;
  label: string;
  /** Optional: limit to specific stages. Defaults to ["dispatched", "info_sent", "negotiation"]. */
  stages?: Array<
    | "new"
    | "ignored"
    | "info_sent"
    | "negotiation"
    | "po"
    | "dispatched"
  >;
};

export const businessProfile = pgTable("business_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * Singleton lock: every row must have this set to the literal 'singleton'.
   * Combined with the unique constraint below this guarantees exactly one
   * row can ever exist. Anywhere in the codebase that reads the profile
   * should go through getBusinessProfile() / upsertBusinessProfile() so the
   * invariant holds end-to-end.
   */
  singletonLock: text("singleton_lock")
    .notNull()
    .default("singleton")
    .unique(),
  companyName: text("company_name"),
  gstin: text("gstin"),
  fssaiNumber: text("fssai_number"),
  certifications: text("certifications").array(),
  defaultTone: text("default_tone").default("warm-professional"),
  defaultCurrency: text("default_currency").default("INR"),
  pitchOneLiner: text("pitch_one_liner"),
  // Owner-edited freeform "this is how we write" file. Injected into every
  // draft's system prompt so replies sound like us, not like a generic LLM.
  // 5-10 sentences with sample phrases the owner actually uses is plenty.
  brandVoice: text("brand_voice"),
  allowedEmails: jsonb("allowed_emails")
    .$type<AllowedEmail[]>()
    .default([]),
  followUpInfoSentDays: integer("follow_up_info_sent_days").default(4),
  followUpNegotiationDays: integer("follow_up_negotiation_days").default(3),
  /** How long after a won deal goes silent before we nudge for a reorder.
   *  0 / null disables the radar entirely. */
  reorderNudgeDays: integer("reorder_nudge_days").default(90),
  dailyAiCostCapInr: numeric("daily_ai_cost_cap_inr", {
    precision: 10,
    scale: 2,
  }).default("100.00"),
  inboxKeywords: text("inbox_keywords").array().default(sql`'{"makhana"}'::text[]`),
  gmailSyncEnabled: boolean("gmail_sync_enabled").notNull().default(true),
  pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(2),
  /** Calendar dates that trigger auto-draft greetings — see FestiveDate. */
  festiveDates: jsonb("festive_dates").$type<FestiveDate[]>().default([]),
  classifierProvider: llmProviderEnum("classifier_provider")
    .notNull()
    .default("gemini"),
  classifierModel: text("classifier_model").notNull().default("gemini-2.5-flash"),
  drafterProvider: llmProviderEnum("drafter_provider")
    .notNull()
    .default("openai"),
  drafterModel: text("drafter_model").notNull().default("gemini-2.5-flash"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────────────────────
// Relations
// ────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads, { relationName: "assignedLeads" }),
  ownedLeads: many(leads, { relationName: "ownedLeads" }),
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
  customer: one(customers, {
    fields: [leads.customerId],
    references: [customers.id],
  }),
  messages: many(emailMessages),
  drafts: many(aiDrafts),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  lead: one(leads, {
    fields: [emailMessages.leadId],
    references: [leads.id],
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

// ────────────────────────────────────────────────────────────────────────────
// Draft edit-pairs — captures the AI's original draft alongside what the
// human actually sent. Used in two ways:
//   1. Few-shot examples appended to the drafter prompt so future drafts
//      mimic the team's edits (tone learning).
//   2. Reporting on how often / how heavily drafts get edited (quality proxy).
//
// We persist on send only — discards aren't useful learning signal.
// ────────────────────────────────────────────────────────────────────────────

export const draftEditPairs = pgTable(
  "draft_edit_pair",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    draftId: uuid("draft_id").references(() => aiDrafts.id, {
      onDelete: "set null",
    }),
    /** What the AI produced. */
    originalBody: text("original_body").notNull(),
    /** What the human actually sent. */
    finalBody: text("final_body").notNull(),
    /** Cheap edit-distance ratio (0 = identical, 1 = totally rewritten). */
    editRatio: numeric("edit_ratio", { precision: 4, scale: 3 }),
    language: languageEnum("language"),
    sentBy: text("sent_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("edit_pair_created_idx").on(t.createdAt),
    index("edit_pair_lead_idx").on(t.leadId),
  ],
);

export type DraftEditPair = typeof draftEditPairs.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// AI call telemetry — one row per LLM invocation. Powers cost tracking, the
// daily cap, and the "AI activity" panel in Reports. Insert is best-effort;
// failures here should never block the actual classify/draft call.
// ────────────────────────────────────────────────────────────────────────────

export const aiCallTaskEnum = pgEnum("ai_call_task", ["classify", "draft"]);
export const aiCallStatusEnum = pgEnum("ai_call_status", [
  "ok",
  "error",
  "cap_blocked",
]);

export const aiCalls = pgTable(
  "ai_call",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    task: aiCallTaskEnum("task").notNull(),
    provider: llmProviderEnum("provider").notNull(),
    model: text("model").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costInr: numeric("cost_inr", { precision: 10, scale: 4 }),
    latencyMs: integer("latency_ms"),
    status: aiCallStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_call_created_idx").on(t.createdAt),
    index("ai_call_task_idx").on(t.task),
    index("ai_call_status_idx").on(t.status),
  ],
);

export type AiCall = typeof aiCalls.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// Sample dispatches
//
// Most B2B deals progress through a "we'll send you a sample" → wait for
// receipt → follow up for feedback loop. This tiny table tracks the dispatch
// so the sample-follow-up cron can draft a check-in N days after delivery.
// ────────────────────────────────────────────────────────────────────────────

export const sampleStatusEnum = pgEnum("sample_status", [
  "pending_dispatch",
  "in_transit",
  "delivered",
  "follow_up_sent",
  "closed",
]);

export const sampleDispatches = pgTable(
  "sample_dispatch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sku: text("sku"),
    quantityNote: text("quantity_note"),
    courier: text("courier"),
    awb: text("awb"),
    sentAt: timestamp("sent_at", { mode: "date" }),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    /** When the follow-up draft should be generated. Defaults to deliveredAt + 3 days. */
    followUpDueAt: timestamp("follow_up_due_at", { mode: "date" }),
    followUpDraftId: uuid("follow_up_draft_id").references(() => aiDrafts.id, {
      onDelete: "set null",
    }),
    status: sampleStatusEnum("status").notNull().default("pending_dispatch"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("sample_lead_idx").on(t.leadId),
    index("sample_status_idx").on(t.status),
    index("sample_followup_due_idx").on(t.followUpDueAt),
  ],
);

export type SampleDispatch = typeof sampleDispatches.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// Inventory & stock movements
// ────────────────────────────────────────────────────────────────────────────

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" })
    .unique(),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movement", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryId: uuid("inventory_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  type: text("type").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const inventoryRelations = relations(inventory, ({ one, many }) => ({
  product: one(products, {
    fields: [inventory.productId],
    references: [products.id],
  }),
  movements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  inventory: one(inventory, {
    fields: [stockMovements.inventoryId],
    references: [inventory.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  lead: one(leads, {
    fields: [stockMovements.leadId],
    references: [leads.id],
  }),
}));

// ────────────────────────────────────────────────────────────────────────────
// Customers
// ────────────────────────────────────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerCode: text("customer_code").unique().notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  address: text("address"),
  gstin: text("gstin"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  leads: many(leads),
}));

export type Customer = typeof customers.$inferSelect;

// Type helpers
export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type AiDraft = typeof aiDrafts.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
