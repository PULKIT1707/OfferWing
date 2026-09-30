# Offerwing

AI job-search agents for LinkedIn users. Offerwing audits your profile, scores jobs against your background, writes a tailored resume and application kit for each role, and finds people in your network who can refer you. Everything it writes is a draft you review. It never logs into LinkedIn or sends anything on your behalf.

> Status: feature-complete early build. The web app, the Chrome extension and every agent in the plan are built and tested up to the AI call; they still need a live run with a real AI key before launch. The full product plan is in [PLAN.md](PLAN.md).

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Data model and security](#data-model-and-security)
- [Agents](#agents)
- [AI modes and bring-your-own-key](#ai-modes-and-bring-your-own-key)
- [Routes](#routes)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Conventions](#conventions)
- [Roadmap](#roadmap)

---

## What it does

| Area | Page | What happens |
|---|---|---|
| Today | `/dashboard` | Due items, referral opportunities, inbox count and a **Career Coach** weekly plan built from the state of your search. |
| Onboarding | `/onboarding` | A wizard that collects target roles, locations, work mode, seniority, salary, sponsorship needs, companies to avoid, your resume / LinkedIn PDF, and how AI should be powered. |
| Profile health | `/dashboard/profile` | **Profile Optimizer** scores your LinkedIn profile from 0 to 100 by section and writes headline variants, an About draft, experience rewrites, skills to pin, keyword gaps and quick wins. |
| Jobs pipeline | `/dashboard/jobs` | An **Inbox** of newly discovered jobs (from forwarded LinkedIn alerts and followed careers pages) above a kanban board. **Job Match** scores fit, lists requirements you meet (with evidence) and gaps, flags preference conflicts and ghost-job signals, and recommends how to apply. |
| Application kit | `/dashboard/jobs/[id]/kit` | **Application Tailor** writes a job-specific resume (downloadable as `.docx`), cover note, LinkedIn connection note and screening answers. A **truthfulness check** flags anything it can't trace back to your documents. |
| Referrals & network | `/dashboard/network` | Import your LinkedIn data export ZIP. **Referral Scout** ranks connections at each target company and drafts referral asks. |
| Referral packets | `/dashboard/packets/[id]`, public `/r/[token]` | A one-page, unlisted link for someone who might refer you: why you fit (each reason traced to your documents), a blurb for their referral tool and your tailored resume. Created from an application kit or a referral ask; view counts; expires after 30 days or when you turn it off. The page carries an Offerwing sign-up link. |
| Get discovered | `/dashboard/talent` | An opt-in, anonymous, fact-checked profile for the **talent marketplace**. Verified recruiting teams search it and send intro requests; accepting shares your contact details with that team and adds the role to your pipeline. Hidden from companies you list (your current employer by default). |
| Outreach | `/dashboard/outreach` | Follow-ups due (max two per person), people to ask for referrals, connection notes for recruiters and hiring managers, a weekly invite budget and recent drafts. You send everything yourself. |
| Content | `/dashboard/content` | A two-week post plan, drafts in your voice with alternative hooks, "Open in LinkedIn" pre-filled posts and comment ideas for posts you paste. |
| Interviews & offers | `/dashboard/interviews` | A STAR story bank built from your resume, per-job prep packs (with web research on Anthropic), practice feedback, offer comparison and negotiation plans. |
| Insights | `/dashboard/insights` | Pipeline and activity metrics. |
| Settings | `/dashboard/settings` | Application details (what forms ask for), job sources (alert forwarding address and followed careers pages), AI mode and provider key, outplacement program sharing, export all your data as JSON, delete your account. |
| Organizations | `/org`, `/org/[id]`, `/join/[code]` | **Outplacement**: an employer invites leavers with seat-limited invite links, sponsors their AI with its own key (Vault), brands the experience and sees program totals (only once 5 people join) plus individual progress for people who opt in. **Recruiting**: a team Offerwing has verified searches the talent marketplace and sends intro requests. |
| Browser extension | `apps/extension` | Chrome side panel on LinkedIn job, profile and company pages: fit score, who you know, save to pipeline, screening answers. On application forms (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, or any site after a one-time permission) it **fills the form** from your application details, the job's kit and your resume, drafts answers to open questions, and marks the job applied. It never submits, and never touches demographic or consent questions. Reads a page only when you click. |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions, `after()` for background work), **React 19** |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4, `lucide-react` icons, `motion` for animation |
| Auth | Supabase Auth: email/password, Google, LinkedIn (OIDC) |
| Database | Supabase Postgres with row-level security on every table |
| Secrets | Supabase Vault (encrypted per-user AI keys) |
| File storage | Supabase Storage, private `career-docs` bucket with one folder per user |
| LLMs | Anthropic (`@anthropic-ai/sdk`), OpenAI (`openai`), Google Gemini (`@google/genai`) behind one gateway |
| Validation | Zod 4 (also used as the structured-output schema for every model call) |
| Documents | `unpdf` (PDF text), `mammoth` (DOCX text), `docx` (resume generation), `fflate` + `papaparse` (LinkedIn export ZIP/CSV) |

## Repository layout

```
OfferWing/
├── PLAN.md                        Product and system plan (agents, architecture, roadmap)
├── supabase/
│   └── migrations/                SQL migrations, apply in numeric order
│       ├── 0001_onboarding.sql    profiles, search_profiles, career_documents, ai_settings, Vault key RPCs, storage bucket
│       ├── 0002_dashboard.sql     jobs, contacts, delete_my_account()
│       ├── 0003_profile_audits.sql profile_audits, get_user_ai_key()
│       ├── 0004_job_matches.sql   job_matches, cached extracted_text on documents
│       ├── 0005_application_kits.sql application_kits
│       ├── 0006_referral_scout.sql connection_imports, connections, outreach_drafts
│       ├── 0007_extension.sql     private-mode match results, job lookup by URL
│       ├── 0008_job_discovery.sql discovered/dismissed stages, job_sources, inbound_emails, time zones, purge_stale_data()
│       ├── 0009_outreach.sql      follow-ups and connection notes, send tracking
│       ├── 0010_interviews_offers.sql stories, interview_preps, practice_answers, offers
│       ├── 0011_content.sql       content_posts, agent_runs (Starter limits)
│       └── 0012_weekly_plans.sql  weekly_plans
├── .github/workflows/ci.yml       Lint, type check, tests and extension build
└── apps/
    ├── extension/                 Chrome MV3 side panel (esbuild + React); see apps/extension/README.md
    └── web/                       Next.js app
        └── src/
            ├── proxy.ts           Session refresh and route protection (Next 16 "proxy", formerly middleware)
            ├── app/
            │   ├── page.tsx       Marketing landing page
            │   ├── (auth)/        /login, /signup
            │   ├── auth/          OAuth callback, sign-out
            │   ├── onboarding/    Wizard page and server actions
            │   ├── dashboard/     All signed-in pages and their server actions
            │   └── api/           export, kits/[id]/resume, ext/* (extension), inbound/email, cron/*
            ├── components/        landing/, auth/, onboarding/, dashboard/
            └── lib/
                ├── agents/        Prompt, schema and runner for each agent
                ├── llm/           Model gateway: credentials, model routing, generation, errors
                ├── supabase/      Browser, server and service-role clients
                ├── documents.ts   PDF/DOCX text extraction with per-document caching
                ├── resume-docx.ts ATS-friendly .docx resume renderer
                ├── linkedin-export.ts  LinkedIn data-export ZIP parser
                ├── job-alerts.ts  LinkedIn job-alert email parser
                ├── job-sources.ts Greenhouse / Lever / Ashby career-board fetchers
                ├── discovery.ts   Inbox ingestion for alerts and career boards
                └── time.ts        Dates in the user's time zone
```

## Getting started

### Prerequisites

- **Node.js 20.9+** (developed on Node 22) and npm
- A **Supabase** project (the free tier works)
- Optionally, an **Anthropic API key** for Starter mode. Without one, users must add their own key in Settings.

### 1. Install

```bash
git clone https://github.com/PULKIT1707/OfferWing.git
cd OfferWing/apps/web
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations **in order** (`0001` → `0012`). Either:
   - paste each file from `supabase/migrations/` into **SQL Editor** and run it, or
   - with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push` from the repo root.
3. Check that the **Vault** extension is enabled (Database → Extensions → `supabase_vault`). It is on by default in new projects and is needed for Always-on keys.
4. **Auth → URL Configuration**: set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs.
5. Optional: enable the **Google** and **LinkedIn (OIDC)** providers under Auth → Providers. Email/password works without them.

The migrations create the private `career-docs` storage bucket and its policies, so there's nothing to set up by hand in Storage.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in the values described in [Environment variables](#environment-variables).

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000, sign up, and complete onboarding. You'll land on the dashboard.

## Environment variables

Set these in `apps/web/.env.local`. It's gitignored; never commit it.

| Variable | Required | Where it's used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable (anon) key. Safe in the browser because RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | For Always-on mode, inbound email and cron | **Server-only** secret key. Used to decrypt a user's Vault-stored key during an agent run (`get_user_ai_key()`), to file forwarded alert emails (no user session exists for inbound mail) and by the scheduled jobs. |
| `OFFERWING_STARTER_ANTHROPIC_API_KEY` | For Starter mode | Offerwing's own Anthropic key that powers free Starter usage, within the daily limits below. |
| `NEXT_PUBLIC_EXTENSION_ID` | For the extension | The only extension ID `/extension/connect` will hand a session to. The dev build's ID is fixed by the manifest `key`: `mgoonaiikahlemfjhcdgpdgjmkjjbmbc`. |
| `INBOUND_EMAIL_SECRET` | For alert forwarding | Shared secret your inbound-email provider sends as `?secret=` when it POSTs to `/api/inbound/email`. |
| `ALERT_EMAIL_DOMAIN` | No | Domain of users' alert addresses. Default `alerts.offerwing.app`. |
| `CRON_SECRET` | For scheduled jobs | Vercel Cron sends it as `Authorization: Bearer …` to `/api/cron/*`. |
| `OFFERWING_<PROVIDER>_MODEL_<TIER>` | No | Overrides the default model for one provider and tier, e.g. `OFFERWING_OPENAI_MODEL_PREMIUM=gpt-5`. Provider: `ANTHROPIC`, `OPENAI` or `GEMINI`. Tier: `PREMIUM`, `STANDARD` or `FAST`. |

## Architecture

```
 Browser ──► proxy.ts (refresh Supabase session, guard /onboarding /dashboard)
    │
    ▼
 Server Components (read via RLS-scoped Supabase client)
    │
    ▼
 Server Action ── validate input (Zod), check quota, resolveCredential()
    │             insert a row with status = "running"
    │             return immediately
    └─► after(() => agent run) ──► generateStructured() ──► Anthropic | OpenAI | Gemini
                                         │
                                         ▼
                           update row: status = "complete" | "failed", result JSONB, tokens, model
    ▲
    └── the page polls or refreshes and renders the stored result
```

Key design points:

- **Background work without a queue.** Agent runs are started from Server Actions and finished with Next's `after()`, so the user gets an instant response. Each run is a row with `status` (`running` / `complete` / `failed`). A run stuck in `running` past a stale timeout (for example 5 minutes for job matches) is treated as dead, so users can retry. Long-running routes set `maxDuration = 300`.
- **One model gateway.** Every agent calls `generateStructured()` in [`lib/llm/generate.ts`](apps/web/src/lib/llm/generate.ts) with a tier, a system prompt, stable per-user `context`, a task `prompt` and a Zod schema. The gateway:
  - routes to the user's provider and picks the model with `modelFor(provider, tier)`;
  - uses each provider's native structured output (Anthropic `messages.parse` with `betaZodOutputFormat`, OpenAI Responses API with `zodTextFormat`, Gemini `responseJsonSchema`), so results are always schema-valid;
  - marks the candidate context with `cache_control` on Anthropic, so repeated runs (e.g. scoring 20 jobs) reuse the cached prefix;
  - maps provider errors (401/403/404/429, refusal, truncation) to `UserFacingError` messages the UI shows as they are.
- **Schemas avoid min/max constraints** so that every provider's structured-output mode accepts them. Scores are clamped after parsing (`normalizeMatch`, etc.).
- **Documents are extracted once.** `readDocumentText()` downloads a resume or LinkedIn PDF from Storage, extracts text (at most 60k characters), and caches it in `career_documents.extracted_text` for every later run.

### Model tiers

| Tier | Used for | Anthropic | OpenAI | Gemini |
|---|---|---|---|---|
| `premium` | Profile audit, deep writing | `claude-opus-5` | `gpt-5` | `gemini-2.5-pro` |
| `standard` | Tailored kits, drafts | `claude-sonnet-5` | `gpt-5` | `gemini-2.5-pro` |
| `fast` | Extraction, fit scoring | `claude-haiku-4-5` | `gpt-5-mini` | `gemini-2.5-flash` |

Defaults live in [`lib/llm/models.ts`](apps/web/src/lib/llm/models.ts). Override them with environment variables rather than editing code.

## Data model and security

All user tables have `user_id` and **row-level security** limiting access to `auth.uid()`. The app uses the publishable key plus the user's session everywhere; the service-role key is used for exactly one RPC.

| Table | Purpose |
|---|---|
| `profiles` | Created by the `handle_new_user()` trigger on sign-up. Holds name and a unique `alert_alias` (the planned inbox for forwarded job-alert emails). |
| `search_profiles` | Target roles, locations, work mode, seniority, salary, sponsorship, companies to avoid. |
| `career_documents` | Uploaded resume / LinkedIn PDF / export metadata, plus cached `extracted_text`. Files are stored in Storage at `career-docs/<user_id>/…`. |
| `ai_settings` | AI mode (`starter` / `private` / `cloud`), provider, `key_last4`, and a pointer to the Vault secret. Clients can only **read** it; writes go through RPCs. |
| `jobs`, `contacts` | Pipeline (with `stage` and `fit_score`) and people tied to jobs. |
| `profile_audits`, `job_matches`, `application_kits` | Agent runs: status, JSONB result, model, token counts, error. |
| `connection_imports`, `connections`, `outreach_drafts` | LinkedIn export imports, normalized connections (grouped by `company_key`), and outreach drafts (referral asks, follow-ups, connection notes) with `sent_at`. |
| `job_sources`, `inbound_emails` | Followed careers pages, and metadata (sender, subject, jobs found) of forwarded alert emails. Email bodies are never stored. |
| `stories`, `interview_preps`, `practice_answers`, `offers` | STAR story bank, prep packs, practice feedback, offers with negotiation plans. |
| `content_posts`, `weekly_plans`, `agent_runs` | Post ideas and drafts, Career Coach plans, and a run log used for Starter limits. |
| `application_profiles` | Contact details, links, current role and countries the user can work in, for filling application forms. No demographic data. |
| `referral_packets` | Referral packet content, an unguessable `token`, status (`generating` → `draft` → `live` / `revoked`), view counts and expiry. Users can't change the token or views. |
| `organizations`, `org_members`, `org_invites` | Outplacement programs and recruiting teams, membership roles (`owner` / `admin` / `member`, plus each member's `share_progress` choice) and invite links. `seat_limit`, `sponsorship_ends_at` and `verified` are set by Offerwing staff (service role) only; the Vault secret id is not selectable by users. |
| `talent_profiles`, `intro_requests` | Anonymous marketplace profiles (with a public id, never the user id) and recruiter intro requests. All intro writes go through functions. |

Security-definer functions:

- `set_ai_mode(mode, provider)` and `set_cloud_ai_key(provider, key)` write to `ai_settings` and to **Vault** (`vault.create_secret` / `update_secret`). Switching away from cloud mode deletes the secret immediately.
- `get_user_ai_key(user_id)` reads from `vault.decrypted_secrets`. It can only be executed by the service role, and the key is only ever held in server memory for the length of a call.
- `purge_stale_data()` (service role only, run daily by `/api/cron/cleanup`) deletes imported connections not re-imported within 90 days unless they're on a referral list, and inbound email records after 30 days.
- `delete_my_account()` removes the user's Vault secrets, any organizations they solely own (with their Vault keys), and their `auth.users` row, and all their data is removed by cascade. The Settings action deletes their uploaded files from Storage first.
- Referral packets: `get_referral_packet(token)`, `get_referral_packet_resume(token)` and `record_referral_packet_view(token)` are callable without signing in but return only live, unexpired packets, and never the job description or user id.
- Organizations: `create_organization`, `redeem_org_invite` (seat limit, one sponsor per person), `get_invite_preview` (anonymous), `set_org_ai_key` / `remove_org_ai_key` (admins; Vault), `get_org_ai_key` (service role only), `org_member_list` and `org_progress` (admins; totals only at 5+ members, individual rows only for members sharing progress). `is_org_member` / `is_org_admin` back the RLS policies.
- Marketplace: `search_talent` and `request_intro` (verified recruiting teams only; profiles hidden from matching company names are skipped; 25 intros a day per team), `withdraw_intro`, `respond_intro` (the candidate; accepting creates a pipeline job), `org_intros` (contact details only for accepted intros) and `my_intro_requests`. `company_key()` mirrors `companyKey()` in `lib/dashboard.ts`.

Privacy choices built into the code:

- Keys are **write-only** in the UI. After saving, only `sk-…abcd` is ever shown. Keys are checked against each provider's free model-listing endpoint, so no tokens are spent.
- The LinkedIn export parser keeps only `Connections.csv`, `Messages.csv` and `Positions.csv`. It **drops email addresses** and reduces messages to per-person counts and last-contact dates.
- `/api/export` returns everything stored about the user as JSON (GDPR-style data portability).
- No LinkedIn passwords, cookies or automation. Offerwing only drafts; the user sends.

## Agents

Each agent lives in `src/lib/agents/` as a system prompt, a context builder, a Zod output schema and a normalizer. Runners are started from the Server Actions next to each page.

| Agent | File | Tier | Output |
|---|---|---|---|
| Profile Optimizer | `profile-optimizer.ts` | premium | Overall and per-section scores, headline variants (keyword / value / proof), About draft (≤ 2,600 characters), experience rewrites, top 5 skills, keyword coverage, quick wins, `needs_input` placeholders |
| Job Match | `job-match.ts`, `job-match-runner.ts` | fast | `fit_score` 0–100, verdict, matched requirements with evidence, gaps with honest framing, preference conflicts, red flags, keywords to mirror, recommended channel, talking points. Runs 3 at a time and skips jobs with no description or at excluded companies. |
| Application Tailor | `application-tailor.ts` | standard | Tailored resume where each bullet carries an `evidence` quote, cover note (150–250 words), connection note (≤ 300 characters), screening answers, change log, `needs_input` |
| Truthfulness check | `truthfulness.ts` | — (deterministic) | Checks the kit against the source documents and flags invented companies, titles, numbers, unsupported bullets and unverified skills |
| Referral Scout | `referral-scout.ts` | — / standard | Heuristic ranking of connections per company (role similarity, seniority, recruiters, recent messages), then LLM-drafted referral asks |
| Job Discovery | `lib/discovery.ts`, `job-alerts.ts`, `job-sources.ts` | — (deterministic) | Parses forwarded LinkedIn alert emails and polls Greenhouse / Lever / Ashby boards; matches titles to target roles by head noun; dedupes by source ID and URL; skips avoided companies |
| Outreach | `outreach.ts` | standard | Referral asks, follow-ups (at most two) and connection notes (≤ 300 characters) |
| Interview coach | `interviews.ts` | standard | Story bank extraction, prep packs (company brief with web research on Anthropic, likely questions matched to stories, "tell me about yourself", questions to ask), practice feedback |
| Negotiation | `negotiation.ts` | premium | Assessment, leverage, a concrete ask, email script, call points and fallbacks. No invented competing offers. |
| Content | `content.ts` | standard / fast | Two-week plan, post drafts in the user's voice, comment ideas; discreet in stealth mode |
| Career Coach | `coach.ts` | standard | A weekly plan with 4–6 prioritized actions from a snapshot of the user's search |
| Application autofill | `lib/autofill.ts` (+ `extension/src/lib/form.ts`) | — (deterministic) | Recognizes ATS pages, classifies form fields, plans values from application details, preferences and the kit's answers; skips demographic and consent questions and never overwrites typed values |
| Application answers | `form-answers.ts` | standard | Drafts answers to a form's open questions from the user's documents; multiple-choice answers must match an option; unknowns become `[placeholders]` and are left unticked for review |
| Referral packet | `referral-packet.ts` | standard | Headline, 3–5 fit points each with an evidence quote (untraceable ones are removed), a referral-form blurb and a note to the referrer |
| Talent profile | `talent-profile.ts`, `lib/talent.ts` | standard | Anonymous headline, summary, skills (only ones in the documents) and evidence-backed highlights; names, employers, schools, emails, phones and links are redacted deterministically afterwards |

**No-fabrication rule.** Prompts tell models to use only facts in the user's documents. Where a fact is missing, they insert a `[placeholder]` and list it in `needs_input`, rather than guessing.

## AI modes and bring-your-own-key

Users choose how AI is powered during onboarding and can change it any time in Settings → AI & keys.

| Mode | Key location | Status |
|---|---|---|
| **Starter** (default) | Offerwing's `OFFERWING_STARTER_ANTHROPIC_API_KEY` | Daily limits per user, e.g. **2** profile audits, **20** job matches, **5** application kits, **20** outreach drafts, **5** prep packs, **3** content plans, **3** weekly plans (see `lib/llm/quota.ts` and each agent module) |
| **Always-on** (`cloud`) | User's own OpenAI / Anthropic / Gemini key, encrypted in Supabase Vault | Unlimited, limited only by the user's own provider account |
| **Private** | User's key kept only in the browser extension | Job scoring and form-answer drafts run in the extension, straight from the browser to the provider. Web-only agents explain that they need Starter or Always-on. |
| **Sponsored** | An outplacement organization's key, encrypted in Vault | Applies to Starter-mode members of an active outplacement program. Recorded as `cloud` runs, so Starter limits don't apply; the sponsor controls spend with limits at its provider. Needs `SUPABASE_SERVICE_ROLE_KEY`. |

`resolveCredential()` in [`lib/llm/credentials.ts`](apps/web/src/lib/llm/credentials.ts) picks the key for each run from the user's mode (own cloud key, then sponsor, then Starter).

## Routes

| Route | Type | Notes |
|---|---|---|
| `/` | Page | Landing page |
| `/login`, `/signup` | Page | Signed-in users are redirected to `/onboarding` |
| `/auth/callback` | Route handler | OAuth / email-link code exchange |
| `/auth/signout` | Route handler | Clears the session |
| `/onboarding` | Page (protected) | Setup wizard |
| `/dashboard/*` | Pages (protected) | See [What it does](#what-it-does) |
| `GET /api/export` | Route handler | Downloads all user data as JSON |
| `GET /api/kits/[id]/resume` | Route handler | Downloads a tailored resume as `.docx` (RLS-scoped) |
| `/extension/connect` | Page (protected) | Hands the session to the pinned extension ID after the user clicks Connect |
| `/api/ext/*` | Route handlers | Extension API (`me`, `lookup`, `jobs`, `context`, `matches`, `contacts`, `autofill`, `resume`, `form-answers`, `applied`), authenticated with the user's Bearer token; RLS applies |
| `/r/[token]`, `GET /r/[token]/resume` | Page, route handler (public) | Referral packet and its tailored resume; `noindex`; link-preview bots aren't counted as views |
| `/org`, `/org/[id]` | Pages (protected) | Organization console (doesn't require job-seeker onboarding) |
| `/join/[code]` | Page (public) | Invite preview; signed-in users accept, others sign up or log in first |
| `POST /api/inbound/email` | Route handler | Inbound-email webhook (Postmark JSON or SendGrid form posts), protected by `INBOUND_EMAIL_SECRET` |
| `GET /api/cron/discovery`, `/api/cron/cleanup` | Route handlers | Scheduled in `apps/web/vercel.json`, protected by `CRON_SECRET` |
| `/privacy`, `/terms` | Pages | Drafts for legal review |

Protected routes are enforced in [`src/proxy.ts`](apps/web/src/proxy.ts), which also refreshes the Supabase session cookie on every matched request.

## Scripts

Run from `apps/web`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` | Production build (includes type checking) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | Unit tests (Vitest) for parsers, scoring, the truthfulness check and date handling |
| `npm run typecheck` | `tsc --noEmit` (run `npx next typegen` first on a fresh checkout) |

## Deployment

The app is built for **Vercel**:

1. Import the repo and set **Root Directory** to `apps/web`.
2. Add the environment variables above for Production (and Preview if you use it).
3. In Supabase → Auth → URL Configuration, add your production URL and `https://<your-domain>/auth/callback`.
4. Agent routes use `maxDuration = 300`. Check that your Vercel plan allows functions to run that long, or lower it.
5. **Scheduled jobs:** `apps/web/vercel.json` runs `/api/cron/discovery` daily at 07:00 UTC (Vercel Hobby only allows daily crons; on Pro it can run every 6 hours) and `/api/cron/cleanup` daily. Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.
6. **Alert forwarding:** point an inbound-email provider (for example Postmark inbound, or SendGrid Inbound Parse) at `https://<your-domain>/api/inbound/email?secret=<INBOUND_EMAIL_SECRET>`, and add an MX record for `alerts.<your-domain>` as the provider instructs. Users' addresses are `<alert_alias>@alerts.<your-domain>`.
7. **Extension:** build with `OFFERWING_APP_URL=https://<your-domain> npm run build` in `apps/extension`, and publish it on the Chrome Web Store.

Any Node host that runs `next start` also works, but `after()` needs a runtime that keeps the process alive after the response is sent.

## Conventions

- **This is Next.js 16**, which has breaking changes from earlier versions: `middleware.ts` is now `proxy.ts`, route handlers use typed `RouteContext`, and `params` are async. Read `node_modules/next/dist/docs/` before relying on older patterns (see [`apps/web/AGENTS.md`](apps/web/AGENTS.md)).
- Server-only modules import `"server-only"` so they can't be bundled into client code.
- Errors meant for users are thrown as `UserFacingError` and shown as they are. Anything else is logged and replaced with a generic message.
- Every new table needs `user_id`, RLS enabled, and "own rows" policies in a new numbered migration. Never edit a migration that has already been applied.

## Roadmap

Built: onboarding, profile audit, job discovery inbox (alert emails and careers pages), pipeline with fit scoring, application kits with `.docx` resumes and truthfulness checks, Referral Scout, referral packets, outreach queue, content, interview prep and practice, offers and negotiation, Career Coach weekly plans, the Chrome extension with Private mode and application autofill, outplacement programs, the opt-in talent marketplace, data export, account deletion and retention jobs.

Before launch:

- A **live run** of every agent with a real AI key, then prompt tuning on real output.
- Try the extension on **real LinkedIn pages** and adjust the page-reading rules.
- Configure Google / LinkedIn sign-in, a production email sender, the inbound-email provider, and deployment.
- Legal review of `/privacy` and `/terms` (they don't yet cover organizations, sponsorship, referral packets or the marketplace); Chrome Web Store submission (the extension now asks for ATS host permissions and optional per-site access).
- Try autofill on **real ATS forms** (Workday's multi-step forms and custom dropdowns especially).
- A staff process (or admin tool) for verifying recruiting teams and setting outplacement seats and sponsorship dates; today that's done in SQL with the service role.
- Observability (error tracking, AI spend per user) and evals for each agent.

## License

Proprietary. All rights reserved.
