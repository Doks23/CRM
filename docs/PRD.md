# White Pops CRM — Product Requirements Document (MVP)

**Brand:** White Pops (Makhana / fox nut processing)
**Owner:** Saurabh D
**Last updated:** 2026-05-14
**Status:** Draft v1 — Milestone 0 in implementation

---

## 1. Background & Goal

Saurabh runs **White Pops**, a Makhana (fox nut) processing unit. Leads arrive primarily through Gmail — LinkedIn lead-gen notifications, direct customer emails, and inquiry-form forwards. Volume is high (especially inquiries), and a meaningful share are cold/spam. Today, triage, response drafting, and follow-up tracking happen manually and inconsistently.

**Goal:** Build a self-hosted CRM that ingests Gmail, uses AI to triage and draft replies, and tracks the lead all the way from first email to repeat order. The MVP is deliberately narrow: prove the AI loop works on the real inbox before expanding into orders, samples, and quotations.

**Non-goals for MVP**
- Sending replies automatically (human-in-the-loop only)
- Order/inventory/dispatch modules
- Sample-shipment tracking
- WhatsApp / phone integration
- Quotation PDF generation

These move to v2+.

**In scope (added after first review)**
- Reporting dashboard (see §9.5)
- AI-drafted replies saved as Gmail Drafts so they're reviewable in Gmail too, not only in the CRM

---

## 2. Personas & Roles

Three roles, RBAC enforced at API and UI layer:

| Role | Sees | Can do |
|---|---|---|
| **Owner** | Everything | Connect Gmail, manage users, edit catalog, view/edit any lead, reassign, override AI |
| **Sales rep** | Leads assigned to them + unassigned queue | Review/edit AI drafts, send replies, change stage, add notes, claim unassigned leads |
| **Production / Dispatch** | Only leads at stage `PO Received` or later | Mark dispatch status, add internal notes (MVP keeps this thin — full module in v2) |

Auth: Google OAuth via Auth.js. Only emails on an allowlist (managed by Owner) can sign in.

---

## 3. User Stories (MVP)

### As an Owner
1. Connect my business Gmail account once, with consent for read + send + modify scopes.
2. Add team members by email; assign roles.
3. Open the CRM and see a triaged inbox — relevant leads at top, cold/spam hidden by default.
4. See an AI-drafted reply next to each lead, edit it, send it from the CRM (it lands in Gmail's Sent folder).
5. Define products: SKU, grade, MOQ, price tiers, current stock note. The AI uses this to draft accurate replies.
6. Assign a lead to a sales rep with one click.
7. See a pipeline board: which leads at which stage, who owns each, days since last activity.

### As a Sales rep
1. Log in via Google; land on my assigned leads.
2. Read the full email thread inline; see the AI's classification and reasoning.
3. Approve, edit, or rewrite the draft; send.
4. Move the lead through stages manually as conversations evolve.
5. Get a follow-up nudge if a lead I sent has gone silent past a configurable window (default 4 days).

### As Production/Dispatch (lightweight in MVP)
1. See only leads marked `PO Received` or `Dispatched`.
2. Add an internal note when goods leave the facility.

---

## 4. System Architecture

```
                  ┌──────────────────────┐
                  │  Gmail (shared inbox)│
                  └─────────┬────────────┘
                            │ Gmail API (OAuth refresh token)
                            │
   ┌────────────────────────┼─────────────────────────────┐
   │   Vercel (Next.js 15, App Router)                    │
   │   - UI (React / shadcn-ui / Tailwind)                │
   │   - API routes (Server Actions + Route Handlers)     │
   │   - Auth.js (Google OAuth + allowlist)               │
   └──────┬───────────────────────────┬───────────────────┘
          │                           │
          │ Drizzle ORM               │ trigger
          ▼                           ▼
   ┌──────────────┐          ┌─────────────────────┐
   │ Neon Postgres│          │   Inngent functions │
   │ (managed)    │          │  (durable workers)  │
   └──────────────┘          │ - gmail.poll        │
          ▲                  │ - ai.classify       │
          │                  │ - ai.draft          │
          │                  │ - follow_up.tick    │
          └──────────────────┴─────────┬───────────┘
                                       │
                                       ▼
                        ┌──────────────────────┐
                        │  Anthropic Claude API│
                        │  - haiku 4.5 classify│
                        │  - sonnet 4.6 drafts │
                        │  - prompt caching ON │
                        └──────────────────────┘
```

**Why Inngest:** Vercel functions are short-lived; Gmail polling, AI calls, and follow-up timers need durable background execution. Inngest is Vercel-native, has retries/timeouts/step functions, runs cron, and has a generous free tier. Alternative considered: Vercel Cron + QStash; rejected because Inngest's step DAG is cleaner for the multi-stage AI pipeline.

**Why Neon over Supabase:** Auth.js + Drizzle is simpler against a vanilla Postgres. Supabase is great if we'd lean on its auth/RLS/storage, but we're using Auth.js so we don't get that leverage. Neon's branching is also helpful for dev.

---

## 5. Data Model

Drizzle schema, Postgres. Tables (MVP):

### `users`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| email | text unique | matched to Google identity |
| name | text | |
| role | enum('owner','sales','production') | |
| active | bool | toggles login |
| created_at | timestamptz | |

### `gmail_account`
Single row in MVP (shared inbox). Stores OAuth refresh token (encrypted with `ENCRYPTION_KEY` env), last history ID for incremental sync, last poll time.

### `leads`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| primary_email | citext | dedup key |
| contact_name | text | extracted by AI, editable |
| company | text | |
| phone | text | |
| source | enum('linkedin','gmail_direct','inquiry_form','referral','unknown') | |
| lead_type | enum('bulk','retail','inquiry','partnership','export','sample_request','spam') | |
| stage | enum — see §6 | |
| score | int 0-100 | AI-assigned, editable |
| assigned_user_id | uuid fk users.id null | unassigned = queue |
| owner_user_id | uuid fk users.id null | original capturer |
| ai_summary | text | one-paragraph AI summary, updated on each new message |
| ai_extracted | jsonb | {quantity, product_interest, budget, region, urgency, …} |
| first_contact_at | timestamptz | |
| last_activity_at | timestamptz | indexed |
| created_at | timestamptz | |

### `email_threads`
| col | type |
|---|---|
| id | uuid pk |
| lead_id | uuid fk |
| gmail_thread_id | text unique |
| subject | text |
| last_message_at | timestamptz |

### `email_messages`
| col | type |
|---|---|
| id | uuid pk |
| thread_id | uuid fk |
| gmail_message_id | text unique |
| direction | enum('inbound','outbound') |
| from_email | text |
| to_emails | text[] |
| received_at | timestamptz |
| body_text | text |
| body_html | text |
| ai_category | enum('relevant','cold','spam','internal','newsletter') |
| ai_confidence | numeric(3,2) |
| ai_reason | text |
| processed_at | timestamptz null |

### `ai_drafts`
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| lead_id | uuid fk | |
| in_reply_to_message_id | uuid fk email_messages.id | |
| draft_body | text | initial AI output |
| edited_body | text null | latest version after edits (CRM or Gmail) |
| language | enum('en','hi','hinglish') | detected from inbound |
| status | enum('pending','approved','edited','sent','discarded') | |
| gmail_draft_id | text null | id from gmail.users.drafts.create |
| sent_message_id | text null | Gmail message ID after send |
| last_synced_at | timestamptz null | last sync between DB draft and Gmail draft |
| created_at | timestamptz | |
| sent_at | timestamptz null | |
| sent_by | uuid fk users.id null | |

### `activities`
Audit log: `id, lead_id, user_id, type, payload jsonb, at`. Types: `note_added`, `stage_changed`, `assigned`, `email_sent`, `draft_edited`, `ai_classified`.

### `follow_ups`
| col | type |
|---|---|
| id | uuid pk |
| lead_id | uuid fk |
| due_at | timestamptz |
| reason | text |
| status | enum('pending','done','dismissed') |
| created_by | enum('system','user') |

### `products`
| col | type |
|---|---|
| id | uuid pk |
| sku | text unique |
| name | text | e.g. "Premium Makhana 4-Suta" |
| grade | text | 4-suta / 5-suta / 6+ |
| pack_size | text | 250g / 1kg / 10kg |
| moq | int |
| price_retail | numeric |
| price_wholesale | numeric |
| price_export_usd | numeric null |
| stock_note | text | freeform: "in stock", "2-week lead time" |
| active | bool |

---

## 6. Pipeline Stages

Default stages (Owner can rename in settings later, MVP is fixed):

1. **New** — captured, not yet reviewed
2. **Qualified** — AI or rep marked relevant, intent confirmed
3. **Info Sent** — first reply sent (catalog, pricing, samples)
4. **Negotiation** — back-and-forth on terms
5. **PO Received** — confirmed order
6. **Dispatched** — production handed off
7. **Won** — delivered and paid
8. **Lost** — closed, reason captured
9. **Nurture** — long-term, periodic check-in

Stage moves are manual in MVP. Automatic moves (e.g., on send → Info Sent) come in v2.

---

## 7. The AI Layer (Core of MVP)

### 7.1 Models
Pluggable. The active provider + model for each task is stored in `business_profile` and editable in Settings. Initial provider set:

- **Google Gemini** (recommended default; Hindi/Hinglish strong, cheap)
- **OpenAI GPT**
- **Ollama** (local self-hosted, zero per-call cost)

Defaults seeded:
- **Classifier:** Gemini `gemini-2.5-flash` — cheap, fast, JSON output
- **Drafter:** OpenAI `gpt-4o` — strong tone control and instruction following

Owner can swap either at any time without code changes. Provider-side caching used when available (Gemini context caching, OpenAI prompt caching) for the business profile + product catalog block.

### 7.2 Classification taxonomy
The classifier returns:
```json
{
  "category": "relevant" | "cold" | "spam" | "internal" | "newsletter",
  "lead_type": "bulk" | "retail" | "inquiry" | "partnership" | "export" | "sample_request" | "n/a",
  "intent": "free-text 1-line summary",
  "confidence": 0.0-1.0,
  "extracted": {
    "contact_name": string | null,
    "company": string | null,
    "phone": string | null,
    "quantity": string | null,
    "product_interest": string | null,
    "region": string | null,
    "budget": string | null,
    "urgency": "low" | "medium" | "high" | null
  },
  "reason": "1-2 sentence explanation"
}
```

Rules:
- `confidence < 0.6` → goes to a **Needs Review** bucket; no draft generated
- `category in ('cold','spam','newsletter')` → archived from main inbox view, no draft, but still stored
- `category = 'relevant'` → upsert lead, queue draft

### 7.3 Draft generation
Inputs to the drafter:
- System prompt: business profile (Saurabh's company, FSSAI/APEDA status, capabilities), tone **warm-professional, Indian B2B**, INR pricing only
- **Language rule:** reply in the same language and script as the inbound message. English in → English out. Hindi (Devanagari) in → Hindi out. Hinglish in → Hinglish out. Classifier and drafter both detect language; never auto-translate without preserving the original
- Cached: product catalog (active SKUs only)
- Per-call: full thread history (last 10 messages), classification output, current lead record

Output: plain-text reply body. Subject line is reused with `Re:`.

Draft is **never auto-sent** in MVP. Two-surface review:
1. Stored in our DB as `ai_drafts` (status `pending`)
2. **Also created as a real Gmail Draft** on the original thread via `gmail.users.drafts.create`. Saurabh can open Gmail on mobile/desktop and see the same draft there. The Gmail draft ID is stored in `ai_drafts.gmail_draft_id`.

On Approve & Send from the CRM: we call `gmail.users.drafts.send` (sends the existing draft, no duplicate), then update `ai_drafts.status = sent`. If Saurabh sends the draft directly from Gmail, the next poll cycle detects the outbound message on the thread, marks the draft `sent` retroactively, and reconciles.

If the draft is edited in either surface before send, we treat the most-recently-modified version as canonical and overwrite the other on next sync.

### 7.4 Follow-up logic
A cron Inngent function runs daily:
- For each lead in stages `Info Sent` or `Negotiation` where last outbound message > N days ago and no inbound reply → create `follow_ups` row + AI-drafted nudge in `ai_drafts`.
- N defaults: Info Sent → 4 days, Negotiation → 3 days. Configurable.

---

## 8. API Surface (high-level)

Server Actions for mutations from the UI; Route Handlers for webhooks and Inngest.

- `POST /api/auth/[...nextauth]` — Auth.js
- `GET /api/gmail/connect` — OAuth start (Owner only)
- `GET /api/gmail/callback` — OAuth finish, stores refresh token
- `POST /api/inngest` — Inngest function endpoint
- Server actions:
  - `assignLead(leadId, userId)`
  - `changeStage(leadId, stage)`
  - `approveDraft(draftId, finalBody)` → calls Gmail send
  - `discardDraft(draftId)`
  - `addNote(leadId, text)`
  - `upsertProduct(productPayload)`
  - `inviteUser(email, role)`

Inngest functions:
- `gmail.poll` — cron every 2 min: fetch new messages by historyId, write to `email_messages`, enqueue classify
- `ai.classify` — runs Haiku, writes back to `email_messages`, upserts lead if relevant, enqueues draft
- `ai.draft` — runs Sonnet, writes `ai_drafts` pending
- `follow_up.tick` — cron daily 09:00 IST

---

## 9. UI / Screens

### 9.1 Inbox (default landing)
Two-pane. Left: list of leads sorted by `last_activity_at`, filterable by stage, lead_type, assigned-to, AI category. Color chip per type. Right: selected lead's thread + AI draft panel.

### 9.2 Lead detail
- Header: contact, company, stage selector, assigned-to, score
- Tabs: Thread • AI Summary • Activity • Notes
- Right panel: AI draft (editable textarea, Approve & Send / Edit / Discard buttons)

### 9.3 Pipeline board
Kanban columns = stages. Cards = leads with name, company, days-since-last-activity, owner avatar. Drag to move stage.

### 9.4 Settings
- Gmail connection status + reconnect (initial account: `doks23@gmail.com`, swappable later)
- Team users (invite by email, set role, deactivate)
- Products (CRUD table)
- Business profile (used in AI prompts: company name, GSTIN, FSSAI #, certifications, default Incoterms)
- Follow-up windows

### 9.5 Reporting dashboard
One screen, date-range filter (default: last 30 days). Sections:

**Inbox health**
- Emails received (line chart by day)
- Breakdown by AI category: relevant / cold / spam / newsletter (stacked bar)
- Breakdown by lead_type: bulk / retail / inquiry / partnership / export / sample_request (donut)
- Language mix: en / hi / hinglish (donut)

**Lead funnel**
- Counts at each pipeline stage (funnel chart)
- Stage-to-stage conversion rates
- Average days in each stage
- Win rate (`Won / (Won + Lost)`)

**Response performance**
- Median time from inbound → draft generated (system metric)
- Median time from draft → sent (human-review latency)
- % of drafts: approved-as-is / edited / discarded — proxy for AI quality
- Replies sent per day

**Per-rep leaderboard**
- Leads assigned, replies sent, deals moved to Won, deals lost, current open leads

**AI cost**
- Daily Anthropic spend (₹) — pulled from internal token-counter; alert if > daily cap

All charts client-side (Recharts). Server returns pre-aggregated JSON; no raw row dumps to the browser.

---

## 10. Security & Compliance

- All secrets via Vercel env vars: `ANTHROPIC_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY`, `AUTH_SECRET`, `INNGEST_SIGNING_KEY`.
- Gmail refresh token encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY`.
- RBAC enforced at server-action layer (not only UI).
- Audit log via `activities` table.
- Rate limit AI calls per lead (cap classify retries; cap draft regenerations).
- Cost guardrail: daily Anthropic spend cap, alert + circuit-break.

---

## 11. Delivery Plan

**Milestone 0 — Foundation (week 1)**
- Next.js scaffold, Drizzle + Neon, Auth.js Google login + allowlist, base shell UI, deploy to Vercel

**Milestone 1 — Gmail ingest (week 2)**
- Gmail OAuth, encrypted token storage, Inngest project, `gmail.poll` writes raw messages

**Milestone 2 — AI classify (week 3)**
- Haiku classifier, lead upsert, thread linkage, Inbox UI showing classified items

**Milestone 3 — AI draft + send (week 4)**
- Sonnet drafter, draft review UI, Gmail send, lands in Sent

**Milestone 4 — Pipeline + team + catalog + follow-ups (week 5)**
- Stages, Kanban, assignment, product CRUD, follow-up cron

**Milestone 5 — Reporting dashboard (week 6)**
- Aggregation queries, Recharts UI, date-range filter, per-rep leaderboard, AI cost panel

**Milestone 6 — Polish + private beta (week 7)**
- Activity log UI, settings polish, you and team start daily use

After daily use proves the loop: roadmap v2 — quotations, samples, orders, WhatsApp, repeat-order intelligence.

---

## 12. Confirmed Answers (2026-05-14)

1. **Shared inbox:** `doks23@gmail.com` (swappable later via Settings → Reconnect).
2. **Domain:** vercel.app subdomain for now; custom domain attached later.
3. **Volume:** 5–10 emails/day. Tiny. AI budget cap: ₹2,000/month is more than enough; we set a ₹500/month soft cap with alert.
4. **Languages:** English + Hindi (Devanagari) + Hinglish. Classifier detects, drafter replies in the same language and script.
5. **Lead identification rule:** universal — classify any incoming email by subject keywords + first lines of body. If not Makhana-related (regardless of source — LinkedIn, direct, inquiry form), category = `cold` or `spam` and it does not enter the active inbox or generate a draft. LinkedIn lead-gen notifications get the same content-based test; the embedded lead message is extracted before classification.
6. **Existing customer CSV:** to be imported later (v2 feature). MVP starts with an empty `leads` table.
7. **Tone:** warm-professional.
8. **Currency:** INR only. No USD in drafts or quotes.

Two additional requirements captured into scope:
- Drafts must be saved as **real Gmail Drafts** (in addition to our DB) so they can be reviewed in Gmail itself. See §7.3.
- **Reporting dashboard** is in MVP (Milestone 5). See §9.5.

---

## 13. Risks

- **Gmail API quotas** — shared inbox at high volume can brush quota limits. Mitigation: use historyId-based incremental sync, not full list polling.
- **AI hallucination on price/MOQ** — drafts could quote wrong numbers. Mitigation: catalog passed as structured data, prompt instructs "never invent prices; if SKU not in catalog, say 'let me confirm and revert'".
- **Compliance** — storing Gmail content in our DB. Mitigation: encryption at rest for tokens, redact PII in logs, document retention policy (default: keep forever; configurable purge in v2).
- **Single-Gmail bus factor** — if the OAuth grant expires or the account is locked, ingest stops. Mitigation: health-check + Slack/email alert.
