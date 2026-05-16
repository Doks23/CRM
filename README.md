# Saathi Prime

AI relationship co-pilot. First tenant: **White Pops**, a Makhana (fox nut)
processing brand. Designed to spin out as a standalone product for Indian
B2B agri-processors over time.

Spec: [`docs/PRD.md`](docs/PRD.md).
Current state: **Milestone 1 — Gmail OAuth + ingest** (scaffold, auth, encrypted token storage, Inngest worker, polling sync, Inbox list view).

---

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui
- Auth.js v5 (Google OAuth + allowlist) with JWT sessions
- Drizzle ORM on Neon Postgres
- Inngest (background workers — wired up from Milestone 1)
- Pluggable LLM layer: Google Gemini, OpenAI, or local Ollama (classifier + drafter — Milestones 2–3)
- Gmail API (shared inbox ingest + send — Milestone 1)

---

## First-time setup

### 1. Install

```bash
npm install
```

### 2. Create accounts

| Service | Purpose | Free tier |
|---|---|---|
| [Neon](https://neon.tech) | Postgres database | Yes — sufficient for MVP |
| [Vercel](https://vercel.com) | Hosting | Yes |
| [Google Cloud Console](https://console.cloud.google.com) | OAuth client for sign-in + Gmail API | Yes |
| [Google AI Studio](https://aistudio.google.com/app/apikey) **or** [OpenAI](https://platform.openai.com/api-keys) **or** [Ollama](https://ollama.com) | LLM provider for classifier + drafter (pick at least one) | Free tier on Gemini Flash; OpenAI is pay-as-you-go; Ollama is local-only |
| [Inngest](https://app.inngest.com) | Background workers | Yes |

### 3. Configure environment

```bash
cp .env.example .env.local
```

Then fill in:

- `DATABASE_URL` — from Neon (use the pooled connection string)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` — Google OAuth client (add `http://localhost:3000/api/auth/callback/google` as authorized redirect URI)
- `ENCRYPTION_KEY` — `openssl rand -hex 32` (64 hex chars)
- `SEED_OWNER_EMAIL` — your Google email; becomes the first Owner
- Other keys can stay blank until their milestone

### 4. Create the database schema

```bash
npm run db:push
```

This pushes the Drizzle schema directly to Neon. For production migrations later use `db:generate` + `db:migrate`.

### 5. Seed allowlist + business profile + sample products

```bash
npm run db:seed
```

This adds your email to the `allowlist` as an Owner so you can sign in.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login` → "Continue with Google" → lands on `/inbox` (currently a placeholder).

---

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript no-emit check |
| `npm run db:push` | Push schema to DB (dev) |
| `npm run db:generate` | Generate SQL migration files |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio (DB browser) at https://local.drizzle.studio |
| `npm run db:seed` | Seed allowlist + business profile + sample products |

---

## Project structure

```
src/
├── app/
│   ├── (app)/              # Auth-protected app shell (sidebar layout)
│   │   ├── inbox/
│   │   ├── pipeline/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── layout.tsx
│   ├── api/auth/[...nextauth]/route.ts
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx            # redirects to /inbox
├── components/
│   ├── app/                # Project-specific components (sidebar, user menu)
│   └── ui/                 # shadcn primitives
├── db/
│   ├── index.ts            # Drizzle + Neon client
│   └── schema.ts           # All tables + relations + enums
├── lib/
│   └── utils.ts
├── types/
│   └── next-auth.d.ts      # Session.user.role augmentation
├── auth.config.ts          # Edge-safe (used by middleware)
├── auth.ts                 # Full Auth.js config (DB-aware)
└── middleware.ts
scripts/
└── seed.ts
drizzle.config.ts
docs/
└── PRD.md                  # Full product spec
```

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add all env vars from `.env.example` under Project Settings → Environment Variables.
4. Update Google OAuth client → Authorized redirect URIs: add `https://<your-vercel-url>/api/auth/callback/google`.
5. Update `NEXTAUTH_URL` to your Vercel URL (or leave unset — Auth.js v5 reads `VERCEL_URL`).

---

## Milestone 1 — Gmail setup

To turn on Gmail ingest you need two more things beyond M0:

### 1. A second Google OAuth client (for Gmail, not for sign-in)

This needs `gmail.readonly`, `gmail.send`, `gmail.modify`, `gmail.compose` scopes — those are restricted and require Google's verification process for production use, but unverified is fine for development with the connecting account as a test user.

1. Console → APIs & Services → **Library** → enable "Gmail API"
2. Console → APIs & Services → **OAuth consent screen** → add `doks23@gmail.com` as a Test user
3. Console → APIs & Services → **Credentials** → Create OAuth client ID (Web)
4. Authorized redirect URI: `http://localhost:3000/api/gmail/callback` (and your Vercel URL later)
5. Paste id/secret into `GMAIL_OAUTH_CLIENT_ID` / `GMAIL_OAUTH_CLIENT_SECRET` in `.env.local`

### 2. Inngest local dev server

In a second terminal:
```bash
npx inngest-cli@latest dev
```
It discovers `/api/inngest` on your Next.js server and runs the cron + event triggers locally. No keys needed for local dev.

### Then

1. `npm run db:push` (the schema gained `gmail_account` columns)
2. `npm run dev`
3. Sign in → open **Settings** → "Connect Gmail" → consent in Google → land back in Settings
4. The first backfill (last 30 days, capped at 50 messages) runs automatically; subsequent polls run every 2 minutes
5. Watch the **Inbox** screen — messages appear as they ingest

---

## Roadmap

See [`docs/PRD.md`](docs/PRD.md) §11. Milestones at a glance:

- **M0** — Foundation ✅
- **M1** — Gmail OAuth + ingest (polling) ✅
- **M2** — AI classification (Gemini / OpenAI / Ollama)
- **M3** — AI drafts + Gmail Drafts + send
- **M4** — Pipeline, team assignment, catalog UI, follow-ups
- **M5** — Reporting dashboard
- **M6** — Polish & private beta
