# White Pops CRM — Product Requirements Document

**Brand:** White Pops (Makhana / fox nut processing)
**Owner:** Saurabh D
**Last updated:** 2026-05-17
**Status:** Implementation complete (M0–M6)

---

## 1. Background & Goal

Saurabh runs **White Pops**, a Makhana (fox nut) processing unit. Leads arrive primarily through Gmail — LinkedIn lead-gen notifications, direct customer emails, and inquiry-form forwards. Volume is high (especially inquiries), and a meaningful share are cold/spam. Today, triage, response drafting, and follow-up tracking happen manually and inconsistently.

**Goal:** Build a self-hosted CRM that ingests Gmail, uses AI to triage and draft replies, and tracks the lead all the way from first email to repeat order.

**Non-goals (v1)**
- Sending replies automatically (human-in-the-loop only)
- WhatsApp / phone integration
- Quotation PDF generation
- Customer CSV import

---

## 2. Personas & Roles

Three roles, RBAC enforced at API and UI layer:

| Role | Sees | Can do |
|---|---|---|
| **Owner** | Everything | Connect Gmail, manage users/employees, edit catalog, view/edit any lead, reassign, override AI, access all settings |
| **Sales rep** | Leads assigned to them + unassigned queue | Review/edit AI drafts, send replies, change stage, add notes, claim unassigned leads |
| **Production / Dispatch** | Only leads at `po` or `dispatched` | Update inventory, mark shipments, limited pipeline view |

Auth: Google OAuth + email/password via Auth.js. Only emails on an allowlist (managed by Owner) can sign in via Google. Credentials sign-in bypasses allowlist for owner-created employees.

---

## 3. User Stories (Implemented)

### As an Owner
1. Connect my business Gmail account once, with consent for read + send + modify scopes.
2. Add team members by email + name + role (auto-generated password shown once).
3. Open the CRM and see a triaged inbox — relevant leads in New Mail, draft-ready threads in Draft.
4. See an AI-drafted reply next to each email, edit it with optional instructions, approve and send (lands in Gmail's Sent folder).
5. Define products: SKU, grade, MOQ, price tiers. The AI uses this to draft accurate replies.
6. Assign a lead to a sales rep with one click.
7. See a pipeline board: leads by stage, who owns each, drag to move.
8. View reports: email volume, funnel conversion, draft quality, AI costs, activity leaderboard.
9. Manage inventory: view stock levels, record movements.
10. Track customer records: add/edit customers, link leads to customers.

### As a Sales rep
1. Log in via email/password or Google; land on dashboard.
2. Read the full email thread inline; see the AI's classification and reasoning.
3. Review, edit with custom instructions, or rewrite the draft; send.
4. Move the lead through stages manually as conversations evolve.
5. See follow-up nudges on the dashboard.

### As Production/Dispatch
1. See leads at `po` or `dispatched` stage.
2. Update inventory and record stock movements.
3. Track sample dispatches with courier/AWB numbers.

---

## 4. System Architecture

```
                  ┌──────────────────────┐
                  │  Gmail (shared inbox)│
                  └─────────┬────────────┘
                            │ Gmail API (OAuth refresh token)
                            │
   ┌────────────────────────┼─────────────────────────────┐
   │   Vercel / Self-host (Next.js 16, App Router)       │
   │   - UI (React 19 / shadcn-ui base-nova / Tailwind 4)│
   │   - API routes (Route Handlers)                     │
   │   - Auth.js v5 (Google OAuth + Credentials)          │
   └──────┬───────────────────────────┬───────────────────┘
          │                           │
          │ Drizzle ORM               │ trigger
          ▼                           ▼
   ┌──────────────┐          ┌─────────────────────┐
   │ Neon Postgres│          │  Inngest functions  │
   │ (managed)    │          │  (durable workers)  │
   └──────────────┘          │ - gmail-poll        │
          ▲                  │ - ai-classify       │
          │                  │ - ai-draft          │
          │                  │ - follow-up-tick    │
          │                  │ - sample-followup   │
          │                  │ - repeat-order-radar│
          └──────────────────┴─────────┬───────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │ LLM Providers (pluggable) │
                        │ - Google Gemini (default) │
                        │ - OpenAI                  │
                        │ - Ollama (local)          │
                        └──────────────────────────┘
```

**Why Inngest:** Vercel functions are short-lived; Gmail polling, AI calls, and follow-up timers need durable background execution.

**Why Neon over Supabase:** Auth.js + Drizzle is simpler against vanilla Postgres. Neon's branching is helpful for dev.

---

## 5. Data Model — Current Schema (16 tables)

Drizzle ORM on PostgreSQL. Full schema in `src/db/schema.ts`.

### Core business tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Auth.js users + role/active | email (unique), role (owner/sales/production), hash (for credentials) |
| `accounts` | Auth.js OAuth account links | provider, providerAccountId, userId FK |
| `sessions` | Auth.js sessions | sessionToken, userId FK, expires |
| `verificationTokens` | Auth.js email verification | identifier, token, expires |

### Gmail integration

| Table | Purpose | Key columns |
|---|---|---|
| `gmailAccount` | Singleton shared inbox connection | email (unique), encryptedRefreshToken, lastHistoryId, lastPolledAt, lastErrorKind |

### CRM core

| Table | Purpose | Key columns |
|---|---|---|
| `leads` | Lead/contact records | leadCode (unique, LEAD-XXXX), primaryEmail, stage (enum), source (enum), leadType (enum), score, assignedUserId FK, customerId FK |
| `emailMessages` | Individual email messages | gmailMessageId (unique), gmailThreadId, direction (inbound/outbound), aiCategory, aiConfidence |
| `aiDrafts` | AI-generated draft replies | draftBody, editedBody, status (pending/approved/edited/sent/discarded), gmailDraftId |
| `customers` | Customer records | customerCode (unique, CUST-XXXX), name, email, phone, company, gstin, address |
| `products` | Product catalog | sku (unique), name, grade, packSize, moq, priceRetail, priceWholesale |

### Inventory & Logistics

| Table | Purpose | Key columns |
|---|---|---|
| `inventory` | Stock per product (1:1) | productId (unique FK), quantity |
| `stockMovements` | Inventory movement log | inventoryId FK, quantity, type (in/out/adjustment), note |
| `sampleDispatches` | Sample shipment tracking | leadId FK, productId FK, courier, awb, status (enum), followUpDueAt |

### AI & Telemetry

| Table | Purpose | Key columns |
|---|---|---|
| `businessProfile` | Singleton business config | companyName, inboxKeywords, classifierProvider, drafterProvider, dailyAiCostCapInr, allowedEmails |
| `draftEditPairs` | AI-vs-human edit tracking | originalBody, finalBody, editRatio, language |
| `aiCalls` | LLM telemetry & cost tracking | task (classify/draft), provider, model, inputTokens, outputTokens, costInr, status, latencyMs |

### Stage enum
`new` → `info_sent` → `negotiation` → `po` → `dispatched`
Hidden: `ignored` (shows as tag, not on pipeline board)

### Source enum
`linkedin`, `gmail_direct`, `inquiry_form`, `referral`, `unknown`

### Lead type enum
`bulk`, `retail`, `inquiry`, `partnership`, `export`, `sample_request`, `spam`

### AI category enum
`relevant`, `cold`, `spam`, `internal`, `newsletter`

### Draft status enum
`pending`, `approved`, `edited`, `sent`, `discarded`

---

## 6. Pipeline Stages

| Stage | Description | Shown on Kanban |
|---|---|---|
| **New** | Captured, not yet reviewed | Yes |
| **Info Sent** | First reply sent (catalog, pricing) | Yes |
| **Negotiation** | Back-and-forth on terms | Yes |
| **PO** | Confirmed order | Yes |
| **Dispatched** | Production handed off | Yes |
| **Ignored** | Not a fit (hidden from board) | No |

Stage moves are manual. Past stages (won, lost, qualified, nurture, needs_review, po_received) have been migrated to current values.

---

## 7. The AI Layer

### 7.1 Models & Providers
Pluggable architecture. Active provider + model stored in `businessProfile`, configurable in Settings:

- **Google Gemini** (default classify + draft) — `gemini-2.5-flash`, `gemini-2.5-pro`
- **OpenAI** — `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`
- **Ollama** (local) — `llama3.1`, `qwen2.5`

Defaults: classifier = Gemini `gemini-2.5-flash`, drafter = Gemini `gemini-2.5-flash`.

### 7.2 Classification
On-demand (user clicks "Run AI Analysis"). Returns:
- Category: relevant / cold / spam / internal / newsletter
- Lead type: bulk / retail / inquiry / partnership / export / sample_request / n/a
- Intent, confidence (0–1), extracted fields (name, company, phone, etc.)
- Reason for classification

Rules:
- `confidence < 0.6` → Needs Review (no draft auto-generated)
- `category in ('cold','spam','newsletter')` → excluded from main inbox
- `category = 'relevant'` → stored, draft can be generated

### 7.3 Web Enrichment
At classify time, fetches sender's website homepage via HTTP (`src/lib/enrich.ts`). Extracts company name, OG tags, description. Skips personal email domains (gmail, yahoo, etc.). Zero-cost, no extra API keys.

### 7.4 Draft Generation
Inputs: business profile, product catalog, thread history (last messages), classification output, lead record.

Language rule: reply in the same language and script as the inbound message (English / Hindi / Hinglish).

Draft is **never auto-sent**. Two-surface review:
1. Stored in DB as `ai_drafts` (status `pending`)
2. Created as a real Gmail Draft on the original thread

On Approve & Send: calls `gmail.users.drafts.send`. Gmail Draft ID is stored in `ai_drafts.gmail_draft_id`.

Optional user instructions for draft re-generation (e.g., "make it shorter", "emphasise quality") — calls the drafter again with the instruction appended.

### 7.5 Cost Controls
- Daily AI cost cap (configurable in Settings, default ₹100/day)
- All LLM calls tracked in `aiCalls` table with token counts and cost
- Cap check before every AI call; returns informative error if exceeded
- Reports dashboard shows spend, trends, and cap utilization

### 7.6 Tone Learning (Module Complete, Not Yet Wired)
`src/lib/ai/tone-learning.ts` loads recent edit pairs (AI draft → human-edited version) to use as few-shot examples. Selection heuristic: edit ratio between 4–85%, minimum 30 chars, language-balanced. Ready to wire into the draft prompt.

---

## 8. API Surface

### Auth
- `POST /api/auth/[...nextauth]` — Auth.js (Google OAuth + Credentials)

### Gmail
- `GET /api/gmail/connect` — OAuth start (Owner only)
- `GET /api/gmail/callback` — OAuth finish, stores refresh token
- `POST /api/gmail/sync` — Trigger manual sync

### Inbox
- `GET /api/inbox/threads` — List threads (filter, search)
- `POST /api/inbox/classify` — Run AI classification on a message
- `POST /api/inbox/draft` — Generate AI draft for a thread
- `POST /api/inbox/regenerate` — Re-generate draft with user instructions
- `POST /api/inbox/send` — Approve & send draft

### Leads
- `GET /api/leads` — List leads
- `POST /api/leads` — Create lead (auto-generates LEAD-XXXX code)
- `PATCH /api/leads/[id]` — Update lead (stage, assignment, notes)
- `PATCH /api/leads/[id]/customer` — Link/unlink customer

### Customers
- `GET /api/customers` — List customers
- `PATCH /api/customers/[id]` — Update customer

### Products
- `GET /api/products` — List products
- `POST /api/products` — Create product
- `PATCH /api/products/[id]` — Update product

### Inventory
- `GET /api/inventory/movements` — List movements with filters
- `POST /api/inventory/movements` — Record stock movement

### Reports
- `GET /api/reports` — Aggregated dashboard data

### Users
- `POST /api/users` — Create employee (Owner only)
- `DELETE /api/users` — Remove employee
- `PATCH /api/users/password` — Change own password

### Inngest
- `GET /api/inngest` — Inngest SDK handler

---

## 9. UI / Screens

### 9.1 Dashboard (`/dashboard`)
- Time-based greeting with user name
- 5 KPI cards: New Mail, Drafts to Review, Samples Follow-up, Reorder Check-ins, AI Spend Today (sparklines + deltas)
- Today's Focus: pending AI drafts with previews
- Inbox Pulse: 14-day bar chart (relevant/other/cold), reply rate stats
- Pipeline Pulse: horizontal stacked bar with stage counts
- Saathi Activity: recent AI call log with timestamps and costs

### 9.2 Inbox (`/inbox`)
Three-panel layout:
1. **Folders Rail** — Triage: New Mail / Draft / All Threads / Awaiting (each with count). By Stage: links with color dots.
2. **Thread List** — Contact avatar, name, lead code, age, company, subject, snippet, stage pill, Draft ready badge. Filter tabs: New / Draft / All. Search via `?q=` preserved across tabs.
3. **Thread View** — Email thread with inbound/outbound styling. StageSelect + CustomerSelect in header. Classification button or Draft panel with edit/send controls. Avatar, direction arrows, timestamps.

Full thread view (`/inbox/[gmailThreadId]`): right rail with LeadMemoryPanel, StageSelect/CustomerSelect, SampleTracker, DetailsCard.

**Sync Status:** Inbox header shows live status "Gmail · synced X ago" with auto-updating timer (refreshes every 30s) and manual refresh button that triggers `POST /api/gmail/sync`. Shows error feedback if sync fails.

### 9.3 Pipeline (`/pipeline`)
Kanban board with 5 columns: New → Info Sent → Negotiation → PO → Dispatched. Drag-and-drop to move stages. Lead cards show name, company, days since activity, assigned user. Lead assignment dialog, create lead button, search/filter.

### 9.4 Customers (`/customers`)
Table view with columns: Code, Name, Company, Email, Phone, GSTIN, Address. Inline edit via Sheet (pencil icon per row). Search bar.

### 9.5 Products (`/products`)
Card grid with create/edit sheet. Fields: SKU, Name, Grade, Pack Size, MOQ, Retail Price, Wholesale Price, Stock Note, Active toggle.

### 9.6 Inventory (`/inventory`)
Per-product stock view. Record movements (add/remove/adjust) with quantity and note. Stock movement log.

### 9.7 Samples (`/samples`)
Sample dispatch tracking. Per lead: SKU, courier, AWB, sent/delivered dates, follow-up due date. Status workflow: pending dispatch → in transit → delivered → follow-up sent → closed.

### 9.8 Reports (`/reports`)
Dynamic = force-dynamic. Sections:
- **Big Stats**: Emails handled, Reply rate, Drafts generated, AI spend today (sparklines)
- **Funnel Card**: 5-stage conversion (New → Info Sent → Negotiation → PO → Dispatched)
- **Inbox Health**: 14-day stacked bar (inbound vs outbound)
- **Source Mix**: Donut by lead source
- **AI Cost**: Today's spend, cap bar, daily trend, call/token details
- **Draft Quality**: Approved/Edited/Discarded %, avg confidence
- **Leaderboard**: Top accounts by activity with sparklines, HOT/STUCK badges

### 9.9 Settings
Sub-pages accessible from sidebar:
- **Gmail** — Connection status, sync interval, connect/reconnect
- **Business Profile** — Company info, brand voice, inbox keywords, follow-up windows, festive dates
- **AI** — Classifier + drafter provider/model selection, cost cap
- **Greetings** — Greeting templates per festival/occasion
- **Account** — Name, email, change password
- **Products** (link)

### 9.10 Employees (`/employees`)
Owner-only: table with name, email, role, status. Create employee (name, email, role → auto-generates password shown once). Delete employee.

### 9.11 Login (`/login`)
Dual sign-in: email/password form + "Continue with Google" button.

---

## 10. Background Jobs (Inngest)

| Function | Trigger | What it does |
|---|---|---|
| `gmail-poll` | Cron `* * * * *` + event `gmail/sync.requested` | Polls Gmail for new messages, persists to DB, skips non-keyword threads |
| `ai-classify` | Event `ai/classify.requested` | Runs LLM classifier on a message, updates lead record |
| `ai-draft` | Event `ai/draft.requested` | Generates draft reply, creates Gmail Draft |
| `follow-up-tick` | Cron daily 8am | Nudges for info_sent/negotiation leads past configured window |
| `sample-followup` | Cron daily 2:20am + event `samples/followup.requested` | Follow-up reminders for delivered samples past due date |
| `repeat-order-radar` | Cron daily | Checks won/dispatched leads silent past nudge window |

---

## 11. Security

- All secrets via environment variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `ENCRYPTION_KEY`, `GMAIL_OAUTH_CLIENT_ID/SECRET`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
- Gmail refresh token encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY`
- RBAC enforced at middleware and route level
- Daily AI cost cap with circuit-break
- Input validation via Zod schemas where applicable

---

## 12. Delivery Plan (Completed)

| Milestone | Features | Status |
|---|---|---|
| **M0 — Foundation** | Next.js scaffold, Drizzle + Neon, Auth.js (Google + Credentials), shell UI, Vercel deploy | ✅ |
| **M1 — Gmail Ingest** | Gmail OAuth, encrypted token storage, Inngest project, polling sync, keyword filter, shared schema | ✅ |
| **M2 — AI Classify** | Plugable LLM layer, Gemini/OpenAI/Ollama providers, on-demand classify, web enrichment, inbox categorization | ✅ |
| **M3 — AI Draft + Send** | Draft generation, Gmail Draft create/send, edit panel, approve flow, re-generation with instructions | ✅ |
| **M4 — Pipeline + Team** | Kanban board, stage management, lead assignment, product catalog, follow-up cron, team/employee management | ✅ |
| **M5 — Reports** | Aggregation queries, KPI cards, funnel, inbox health, source mix, AI cost, draft quality, leaderboard, sparklines | ✅ |
| **M6 — Polish + Extras** | Inventory, samples, customers, settings pages, loading/error states, error audit, My Account, password change, search across filters | ✅ |

---

## 13. Environment Variables

```
DATABASE_URL                  # Neon Postgres pooled connection string
AUTH_SECRET                   # openssl rand -base64 32
AUTH_GOOGLE_ID                # Google OAuth client ID
AUTH_GOOGLE_SECRET            # Google OAuth client secret
ENCRYPTION_KEY                # openssl rand -hex 32 (64 hex chars)
SEED_OWNER_EMAIL              # First owner email for db:seed
GMAIL_OAUTH_CLIENT_ID         # Separate OAuth client for Gmail API
GMAIL_OAUTH_CLIENT_SECRET     # Gmail OAuth client secret
NEXT_PUBLIC_APP_URL           # http://localhost:3000 (dev)
GEMINI_API_KEY                # Google AI Studio API key
OPENAI_API_KEY                # OpenAI API key
```

---

## 14. Known Gaps & Future Work

### v2 candidates
- Quotation PDF generation
- Lead scoring engine with ML
- Email templates library
- Auto-assignment rules by stage/type
- WhatsApp integration
- Mobile app (REST API layer already designed)
- Customer CSV import
- Activity log UI
- Notifications (email/Slack alerts for errors, high-value leads)
- Multiple Gmail inbox support
- Production order management
- Payment tracking

### Current limitations
- Single Gmail inbox only
- No automatic stage advancement on send
- Tone-learning module built but not wired into draft prompts
- No test files
