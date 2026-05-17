# Saathi Prime — AI CRM for Indian Agri-Processors

AI relationship co-pilot. First tenant: **White Pops**, a Makhana (fox nut)
processing brand. Designed to spin out as a standalone product for Indian
B2B agri-processors over time.

**[Full PRD](docs/PRD.md)**

---

## Status

All milestones (M0–M6) complete. Live features:

| Area | What it does |
|---|---|
| **Auth** | Google OAuth + email/password. Role-based (owner/sales/production). Allowlist gating. |
| **Gmail Sync** | OAuth-based inbox connection, keyword filtering, configurable polling (1min–24h), backfill + incremental. Live "synced X ago" status with auto-update and manual refresh. |
| **Inbox** | Three-panel layout. Filters: New Mail / Draft / All Threads / Awaiting. Search, stage pills, draft panel. |
| **AI Classify** | On-demand classification (relevant/cold/spam/internal/newsletter). Web enrichment at classify time. |
| **AI Draft** | Draft generation with edit/send. Re-generation with custom instructions. Gmail Draft create + send. |
| **Pipeline** | 5-column Kanban (New → Info Sent → Negotiation → PO → Dispatched). Drag-and-drop. Lead assignment. |
| **Customers** | Table with inline edit. Auto-generated CUST-XXXX codes. Link leads to customers. |
| **Products** | CRUD catalog. SKU, grade, pack size, pricing tiers. Used by AI drafts. |
| **Inventory** | Stock tracking per product. Movement logging (in/out/adjustment). |
| **Samples** | Shipment tracking with courier/AWB. Status workflow. Follow-up nudges. |
| **Reports** | KPIs, funnel, inbox health, source mix, AI costs, draft quality, leaderboard. Sparklines. |
| **Dashboard** | KPI tiles, pending drafts, inbox/pipeline pulse, AI activity log. |
| **Settings** | Business profile, AI providers, Gmail, greetings, account, products. |
| **Employees** | Owner-only management. Create/delete employees with roles. |
| **Background Jobs** | Gmail polling, follow-up tick, sample follow-up, repeat-order radar. |
| **Cost Controls** | Daily AI spend cap. Full telemetry on all LLM calls. |

---

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (base-nova) + tw-animate-css
- **Auth:** Auth.js v5 beta (Google OAuth + CredentialsProvider) with JWT sessions
- **Database:** Neon Postgres + Drizzle ORM
- **Background Jobs:** Inngest v4 (Vercel-native durable workers)
- **AI:** Google Gemini / OpenAI / Ollama (pluggable, configured per task in Settings)
- **Email:** Gmail API (readonly, send, modify, compose scopes)
- **UI Components:** Base UI (Radix primitives) + lucide-react icons
- **Icons:** lucide-react
- **Fonts:** Geist (sans), Geist Mono (mono), Instrument Serif (display headings)

---

## Quick Start

### Prerequisites

| Service | Purpose | Free tier |
|---|---|---|
| [Neon](https://neon.tech) | Postgres database | Yes |
| [Google Cloud Console](https://console.cloud.google.com) | OAuth client + Gmail API | Yes |
| [Google AI Studio](https://aistudio.google.com/app/apikey) or [OpenAI](https://platform.openai.com/api-keys) | LLM provider | Gemini Flash free tier |
| [Inngest](https://app.inngest.com) | Background workers | Yes |

### Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in: DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID/SECRET,
# ENCRYPTION_KEY, SEED_OWNER_EMAIL, GMAIL_OAUTH_CLIENT_ID/SECRET,
# GEMINI_API_KEY (or OPENAI_API_KEY)

# 3. Push schema to DB
npm run db:push

# 4. Seed owner + profile + sample products
npm run db:seed

# 5. Start dev server
npm run dev

# 6. In a second terminal (for background jobs):
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login` → sign in → lands on inbox.

### Gmail Setup

1. Enable Gmail API in Google Cloud Console
2. Create OAuth client ID (Web) with redirect URI `http://localhost:3000/api/gmail/callback`
3. Add your email as a Test user on the OAuth consent screen
4. Paste client ID/secret into `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET`
5. Sign in → Settings → Connect Gmail → consent → done

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres pooled connection string |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID (for sign-in) |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `ENCRYPTION_KEY` | Yes | `openssl rand -hex 32` (64 chars) — encrypts Gmail tokens |
| `SEED_OWNER_EMAIL` | Yes | First owner email used by `db:seed` |
| `GMAIL_OAUTH_CLIENT_ID` | For Gmail | Separate OAuth client for Gmail API |
| `GMAIL_OAUTH_CLIENT_SECRET` | For Gmail | Gmail OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` (dev) |
| `GEMINI_API_KEY` | For Gemini | Google AI Studio API key |
| `OPENAI_API_KEY` | For OpenAI | OpenAI API key |

---

## Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript no-emit check (`npx tsc --noEmit`) |
| `npm run db:push` | Push schema to DB (dev) |
| `npm run db:generate` | Generate SQL migration files |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio (DB browser) |
| `npm run db:seed` | Seed owner + profile + sample products |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                    # Auth-protected app shell
│   │   ├── customers/            # Customer table
│   │   ├── dashboard/            # KPI dashboard
│   │   ├── employees/            # Employee management (owner)
│   │   ├── inbox/                # 3-panel inbox + thread detail
│   │   ├── inventory/            # Stock management
│   │   ├── pipeline/             # Kanban board
│   │   ├── products/             # Product catalog
│   │   ├── reports/              # Analytics dashboard
│   │   ├── samples/              # Sample dispatch tracking
│   │   ├── settings/             # Sub-pages (gmail, profile, AI, etc.)
│   │   ├── layout.tsx            # Sidebar + topbar shell
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── api/
│   │   ├── auth/                 # Auth.js route handler
│   │   ├── customers/            # Customer CRUD
│   │   ├── gmail/                # Gmail connect/callback/sync
│   │   ├── inbox/                # Threads, classify, draft, send
│   │   ├── inventory/            # Stock movements
│   │   ├── leads/                # Lead CRUD
│   │   ├── products/             # Product CRUD
│   │   ├── reports/              # Aggregated metrics
│   │   └── users/                # Employee + password management
│   ├── login/
│   ├── layout.tsx                # Root layout (fonts)
│   └── page.tsx                  # Redirects to /inbox
├── components/
│   ├── app/                      # BrandMark, Sidebar, Topbar, etc.
│   ├── inbox/                    # DraftPanel, StageSelect, etc.
│   ├── pipeline/                 # KanbanBoard, LeadCard, etc.
│   ├── reports/                  # Chart components
│   ├── settings/                 # Profile, AI, product editors
│   └── ui/                       # shadcn primitives (button, badge, etc.)
├── db/
│   ├── index.ts                  # Drizzle + Neon client
│   └── schema.ts                 # 16 tables + relations + enums
├── lib/
│   ├── ai/                       # LLM layer (providers, pricing, types)
│   ├── gmail/                    # Gmail client, sync, parse, draft
│   ├── queries/                  # Shared inbox + worklist queries
│   ├── enrich.ts                 # Web enrichment at classify time
│   ├── next-code.ts              # LEAD-XXXX / CUST-XXXX generation
│   ├── business-profile.ts       # Profile cache
│   ├── text-diff.ts              # Edit ratio for tone learning
│   └── utils.ts                  # cn() helper
├── inngest/
│   └── functions/                # ai-classify, ai-draft, gmail-poll, etc.
├── auth.config.ts                # Edge-safe auth config (middleware)
├── auth.ts                       # Full Auth.js config
├── proxy.ts                      # Middleware (auth gate)
└── types/
    └── next-auth.d.ts            # Session.user augmentation
scripts/
└── seed.ts                       # Seed script
drizzle/
└── migrations                    # SQL migration files
```

---

## Inngest Functions

| Function | Trigger | Purpose |
|---|---|---|
| `gmail-poll` | Cron * * * * * + manual event | Poll Gmail, ingest messages |
| `ai-classify` | Event `ai/classify.requested` | Classify message, enrich lead |
| `ai-draft` | Event `ai/draft.requested` | Generate draft, create Gmail Draft |
| `follow-up-tick` | Cron daily 8am | Nudge for stale conversations |
| `sample-followup` | Cron daily 2:20am + event | Follow-up on delivered samples |
| `repeat-order-radar` | Cron daily | Reorder reminders for silent leads |

---

## Auth Architecture

- JWT strategy (no DB sessions per request)
- Google OAuth: gated by `businessProfile.allowedEmails` allowlist
- Credentials (email/password): bypasses allowlist for employees created by owner
- Middleware (`proxy.ts`): protects all routes except `/api/auth/*`, `/api/inngest/*`, `/api/gmail/callback`, `/login`
- Role synced from allowlist or DB on every request via JWT callback

---

## Deploying to Vercel

1. Push to GitHub → Import into Vercel
2. Add all env vars under Project Settings → Environment Variables
3. Update Google OAuth redirect URIs for production URL
4. Set `NEXT_PUBLIC_APP_URL` to your production URL
5. Deploy — the `build` command runs `npm run build` (includes typecheck + lint)

---

## Key Design Decisions

- **On-demand AI** — classify only when user clicks "Run AI Analysis". Saves tokens by not auto-processing every email.
- **Keyword filter** — new threads without matching keywords are completely dropped (no DB writes).
- **Gmail draft at send-time** — avoids stale drafts when user edits text.
- **Pipeline simplified** — 5 active stages (new, info_sent, negotiation, po, dispatched) + hidden ignored.
- **Leads use auto-generated codes** — `LEAD-XXXX`, dedup by leadCode, not email. Same email can have multiple leads.
- **Font sizes bumped ~1px** across all components for readability.
- **HTML5 native drag-and-drop** for pipeline (no extra dependencies).
- **Web enrichment best-effort** — plain HTTP fetch, no API keys, skips personal domains.
- **Soft delete** — leads have `deleted_at` column; queries filter out deleted leads across inbox, pipeline, dashboard, reports, and cron jobs.
