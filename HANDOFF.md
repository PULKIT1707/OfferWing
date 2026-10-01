# Offerwing: handoff for a new session

Give this whole file to the new assistant session as its first message. It explains what Offerwing is, every decision made so far, how the code and database are laid out, how testing is done, the gotchas already hit, and what's left. `README.md` (setup, architecture, routes) and `PLAN.md` (the product plan) have more detail; this file is the working memory that isn't written anywhere else.

---

## 1. Who and what

- **Owner:** Pulkit (GitHub `PULKIT1707`), repo https://github.com/PULKIT1707/OfferWing (private). Local checkout: `/Users/pulkitsrivastava/OfferWing` (macOS, zsh, Node 22.14, npm 10).
- **Product:** **Offerwing** (domain idea `offerwing.ai`, tagline "Your AI wingman from profile to offer"). A free, multi-user SaaS: AI agents for a job seeker's LinkedIn-centred search. A Next.js web app and a Chrome extension.
- **Core principle (non-negotiable):** LinkedIn's terms ban automation, so **Offerwing never clicks, sends, applies, posts or scrapes on LinkedIn**. Agents draft, score and plan; the user acts. We never take LinkedIn passwords or cookies. The only LinkedIn write we ever planned is the official Posts API (not built; needs an app registration). The extension reads a page only when the user clicks "Analyze this page".
- **No fabrication:** resumes, drafts and answers use only facts from the user's documents; missing facts become `[placeholders]`. A deterministic truthfulness checker backs this up.

## 2. Product decisions (all confirmed by the user)

| Decision | Choice |
|---|---|
| Type | Multi-user SaaS, **free** |
| Market | Global; English first; multi-currency; GDPR/CCPA/DPDP-aware |
| Roles | Generic (all roles); target roles and domain are captured at onboarding |
| LinkedIn plan | Captured per user at onboarding (Free / Premium Career / Business / Sales Navigator / Recruiter Lite). The owner personally has Premium. |
| Surfaces | Website and Chrome extension |
| Name | Offerwing (`offerwing.ai` looked available on 2026-09-24; trademark search still to do) |
| AI keys | **Bring your own key**, user-selectable: **Starter** (Offerwing's Anthropic key, daily limits), **Private** (key only in the extension; browser calls the provider directly), **Always-on / cloud** (key encrypted in Supabase Vault, decrypted server-side only at run time). Providers: Anthropic, OpenAI, Gemini. |
| Models | Routed by tier via `lib/llm/models.ts`: premium `claude-opus-5`, standard `claude-sonnet-5`, fast `claude-haiku-4-5`; OpenAI `gpt-5`/`gpt-5-mini`; Gemini `gemini-2.5-pro`/`flash` (OpenAI/Gemini defaults are unverified guesses; override with `OFFERWING_<PROVIDER>_MODEL_<TIER>`). |
| Design | Landing page inspired by the Lovable "Revio" template: Inter Tight, black hero, big tight headings, violet `--wing #6242ff`, lime `--offer #c8f56a`, grey cards `#f4f4f5`, 24px radius. |
| Architecture opinion given | **GraphQL and Neo4j: not now.** Reasons and revisit triggers are in section 11. Recommended next: 2nd-degree "mutual" paths stored in Postgres, and pgvector for semantic matching. |

## 3. Current state (as of 2026-09-26)

- `main` at `9ec61a0`, identical to GitHub. PR #1 (browser extension) and PR #2 (job discovery, outreach, content, interviews, weekly coach) are merged. Feature branches `feature/browser-extension` and `feature/job-discovery-and-agents` still exist locally and on GitHub (merged; safe to delete if the user agrees).
- Everything in the plan is **built and tested up to the AI call**. **No agent has ever run against a real model**, because no AI key has been configured on this machine. Every agent shows a clear "Starter credits aren't available right now" message without one.
- The Supabase database is **empty** (test accounts deleted after each round).
- **Branch `feature/autofill-packets-orgs-marketplace`** (uncommitted when written, 2026-09-26) adds application autofill (extension), referral packets, B2B outplacement organizations and the opt-in talent marketplace. Migrations 0013–0016 are applied to the live project. Tested end to end with fixtures (no AI key): APIs, form scan/fill on a sample Greenhouse-style form, packet publish and public page, org create/invite/join/sponsor/progress, recruiter search/intro/accept, and access boundaries.
- CI (GitHub Actions) exists but its first run on GitHub was never checked (the `gh` CLI isn't logged in; see section 9).

## 4. Repository layout

```
OfferWing/
├── README.md            Setup, env vars, architecture, routes, deployment (kept up to date)
├── PLAN.md              Product plan; section 17 = build status
├── HANDOFF.md           This file
├── .github/workflows/ci.yml   web: npm ci --legacy-peer-deps, next typegen, lint, typecheck, test; extension: typecheck + build
├── supabase/migrations/ 0001 → 0012 (all applied to the live project; see section 6)
├── .claude/launch.json  Dev server config "web" (npm run dev --prefix apps/web -- --port 3000)
└── apps/
    ├── web/             Next.js 16.3.6 (Turbopack), React 19.2, Tailwind 4, TypeScript strict
    │   ├── vercel.json        crons: /api/cron/discovery every 6h, /api/cron/cleanup daily 03:30
    │   ├── vitest.config.mts  aliases "@"→src and "server-only"→test/empty.ts
    │   ├── .env.local         (gitignored) Supabase URL + publishable key, NEXT_PUBLIC_EXTENSION_ID
    │   └── src/
    │       ├── proxy.ts       Next 16 "proxy" (formerly middleware): session refresh, guards /onboarding /dashboard /extension
    │       ├── app/
    │       │   ├── page.tsx                    landing
    │       │   ├── (auth)/login|signup         email+password, Google, LinkedIn OIDC buttons
    │       │   ├── (legal)/privacy|terms       drafts for legal review (visible banner)
    │       │   ├── auth/callback|signout
    │       │   ├── onboarding/                 6-step wizard + actions
    │       │   ├── extension/connect/          hands session to the pinned extension ID
    │       │   ├── dashboard/                  Today, profile, jobs(+[id]/kit), network, outreach, content,
    │       │   │                               interviews(+[jobId]), insights, settings; *actions.ts next to pages
    │       │   └── api/  export · kits/[id]/resume · ext/{me,lookup,jobs,context,matches,contacts}
    │       │             · inbound/email · cron/{discovery,cleanup}
    │       ├── components/  landing/ auth/ onboarding/ dashboard/
    │       └── lib/
    │           ├── agents/      one module per agent (prompt, schema, builders, normalizer) + tests
    │           ├── llm/         credentials, generate (gateway), models, quota, agent-credential, research (web search), errors
    │           ├── supabase/    client (browser), server (cookies), admin (service role, may be null)
    │           ├── documents.ts PDF/DOCX text extraction, cached on the row; loadCareerText()
    │           ├── discovery.ts inbox ingestion (alerts + boards)
    │           ├── job-alerts.ts / job-sources.ts / linkedin-export.ts / linkedin-urls.ts (pure, tested)
    │           ├── time.ts (pure, tested) / user-time.ts (server)
    │           ├── api-auth.ts  Bearer auth for extension routes (RLS still applies)
    │           ├── referrals.ts, resume-docx.ts, secrets.ts, dashboard.ts, onboarding.ts, auth.ts
    └── extension/       Chrome MV3 side panel, React + esbuild (no framework)
        ├── manifest.template.json   has the "key" pinning ID mgoonaiikahlemfjhcdgpdgjmkjjbmbc
        ├── build.mjs      → dist/ (splitting; AI SDKs lazy-loaded); reads Supabase URL/key from ../web/.env.local
        ├── extension-key.pem        (gitignored) private key, only needed to package a .crx; keep it safe
        ├── static/        sidepanel.html/.css, icons (generated)
        └── src/  background.ts (panel behavior + onMessageExternal session handoff)
                  lib/ api, config, extract (self-contained page reader), llm (browser gateway),
                       private-key, private-scoring, supabase (chrome.storage adapter), errors
                  sidepanel/ App, JobView, OtherViews (profile/company), People, Settings, ui, types
```

The extension imports shared pure code from `apps/web/src` through the `@/` alias (esbuild alias + tsconfig paths) and forces a single `zod` copy.

## 5. Features and agents (what exists)

| Area | Where | Notes |
|---|---|---|
| Landing | `/` | Revio-style sections, FAQ, pricing "Free. Really." (3 key modes) |
| Onboarding | `/onboarding` | career → preferences → linkedin → documents → ai → connect; answers saved per step; `profiles.onboarding_step` |
| Today | `/dashboard` | stats, due today, referral opportunities, inbox banner, setup checklist, **Career Coach weekly plan** (`weekly_plans`) |
| Profile health | `/dashboard/profile` | readiness score + **Profile Optimizer** (premium tier, runs in `after()`, polls) |
| Jobs | `/dashboard/jobs` | **Inbox** (stage `discovered`) + kanban (saved→offer) + closed; **Job Match** (fast tier, 3 concurrent, auto-scores new jobs with descriptions); job modal = fit panel + link to kit |
| Application kit | `/dashboard/jobs/[id]/kit` | **Application Tailor** (standard) + deterministic **truthfulness check** + `.docx` download |
| Referrals | `/dashboard/network` | LinkedIn export import (no emails, no message text kept), **Referral Scout** deterministic scoring with reasons, drafts |
| Outreach | `/dashboard/outreach` | follow-ups (max 2), to-ask, connection notes (≤300 chars), weekly invite budget 80, drafts with `sent_at` |
| Content | `/dashboard/content` | 2-week plan, drafts in user voice with hook options, LinkedIn share URL, comment ideas; stealth-aware |
| Interviews & offers | `/dashboard/interviews`, `/[jobId]` | story bank (STAR), prep packs (web research on Anthropic via `web_search_20260209`), practice feedback, offers comparison, negotiation plan (premium) |
| Insights | `/dashboard/insights` | funnel + response rate by channel (excludes inbox/dismissed) |
| Settings | `/dashboard/settings` | onboarding forms reused (`embedded`), **Job sources** (alert address, Gmail/Outlook steps, Gmail confirmation code, followed Greenhouse/Lever/Ashby boards), AI & keys, documents, export, delete account |
| Job discovery | `lib/discovery.ts` + `/api/inbound/email` + `/api/cron/discovery` | alert emails parsed (HTML + text), boards polled; dedupe by `external_id` and URL; title matching by **head noun** (`matchesTargetRoles`) |
| Extension | `apps/extension` | job/profile/company views, save & score, who you know, add to list, screening answers from latest kit, Private-mode scoring in browser, settings (key + disconnect) |
| Retention | `/api/cron/cleanup` → `purge_stale_data()` | connections not re-imported in 90 days (unless on a list), inbound email records after 30 days |

**Starter daily limits:** 2 audits, 20 matches, 5 kits, 20 outreach drafts, 5 prep packs, 20 practice answers, 5 negotiation plans, and via `agent_runs`: 3 content plans, 10 post drafts, 20 comment ideas, 3 story-bank builds, 3 weekly plans.

**Common agent pattern:** `resolveCredential()` (mode → key; private mode errors on the web) → Starter quota check → `generateStructured({credential, tier, system, context?, prompt, schema, schemaName})` → normalize → store. Long runs insert a `running` row and finish in `after()`; UI polls with `router.refresh()`; stale-after timeouts (5–10 min) let users retry. Schemas avoid min/max (all three providers must accept them); clamp after parsing. Anthropic Opus 5 calls use server-side fallbacks (`betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"`); Haiku calls omit `effort`.

## 6. Database (Supabase)

- Project **`offerwing`**, ref **`nkuoagnnkfjvdjhhmdzu`**, us-east-1, org "Matchly" (`zgnnxhqwcgpvakxvvorf`), $0/month. URL `https://nkuoagnnkfjvdjhhmdzu.supabase.co`. The publishable key is in `apps/web/.env.local`. The **service-role key is not configured anywhere yet.**
- Supabase MCP tools were used for `apply_migration`, `execute_sql`, `get_advisors`. Always write the SQL to `supabase/migrations/NNNN_name.sql` and apply the same SQL; never edit applied migrations.
- Every table has `user_id` and RLS "own rows" policies. Service role is used only for: `get_user_ai_key()`, inbound email ingestion, cron.

| Migration | Adds |
|---|---|
| 0001 | profiles (trigger `handle_new_user`, `alert_alias`, onboarding_step), search_profiles, career_documents, ai_settings, `set_ai_mode`, `set_cloud_ai_key` (Vault), private `career-docs` bucket + policies |
| 0002 | jobs, contacts, `delete_my_account()` |
| 0003 | profile_audits, `get_user_ai_key()` (service role only) |
| 0004 | job_matches, career_documents.extracted_text |
| 0005 | application_kits (with `verification`) |
| 0006 | connection_imports, connections (`company_key`), outreach_drafts, contacts.connection_id |
| 0007 | job_matches.credential allows `private`; index jobs(user_id,url) |
| 0008 | jobs stages `discovered`/`dismissed`, jobs.external_id (unique per user, partial index), job_sources, inbound_emails, profiles.time_zone, `purge_stale_data()` |
| 0009 | outreach_drafts kinds follow_up/connection_note + sent_at, contacts.follow_ups_sent |
| 0010 | stories, interview_preps, practice_answers, offers |
| 0011 | content_posts, agent_runs |
| 0012 | weekly_plans (pk user_id+week_start) |
| 0013 | application_profiles; referral_packets (+ public token functions); agent_runs agents form_answers / referral_packet / talent_profile |
| 0014 | organizations, org_members, org_invites, `company_key()`, invite/sponsor/progress functions, org Vault keys; `delete_my_account` also deletes solely owned orgs |
| 0015 | talent_profiles, intro_requests, search/intro functions; jobs.source `marketplace` |
| 0016 | hardening: `require_verified_recruiter` / `talent_hidden_from` not directly callable; dropped `get_my_sponsor` |
| 0017 | search_profiles.seniority and talent_profiles.seniority become text[]; new accounts start onboarding at `documents`; agent `profile_prefill`; search_talent recreated |

Supabase advisors: the only remaining warnings are the three intentional self-service security-definer functions (`delete_my_account`, `set_ai_mode`, `set_cloud_ai_key`) and "leaked password protection disabled" (a dashboard setting).

## 7. Environment variables (apps/web)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (set) · `NEXT_PUBLIC_EXTENSION_ID=mgoonaiikahlemfjhcdgpdgjmkjjbmbc` (set) · `SUPABASE_SERVICE_ROLE_KEY` (not set; needed for Always-on, inbound email, cron) · `OFFERWING_STARTER_ANTHROPIC_API_KEY` (not set; needed for any live AI run in Starter mode) · `INBOUND_EMAIL_SECRET`, `ALERT_EMAIL_DOMAIN` (default `alerts.offerwing.ai`), `CRON_SECRET` (not set) · optional `OFFERWING_<PROVIDER>_MODEL_<TIER>`. Documented in `.env.example` and README.

## 8. How to work in this repo (conventions and commands)

- **Next.js 16 is different:** read `apps/web/node_modules/next/dist/docs/` before using Next APIs. `proxy.ts` not middleware; async `params`; `PageProps<"/route">`, `LayoutProps`, `RouteContext` globals come from `npx next typegen` (run it after adding routes, or tsc fails). `after()` for background work; `revalidatePath`; server actions files (`"use server"`) may only export async functions (put constants elsewhere).
- **Lint rules that bite:** `react-hooks/purity` (no `Date.now()` in render; move to a helper function in lib), `react-hooks/set-state-in-effect` (load data in event handlers or on the server, not in `useEffect`), `react/no-unescaped-entities`, rules-of-hooks (don't name helpers `useX`).
- **React state:** use functional updates `setV(p => ({...p, ...patch}))` in forms (a real bug was fixed here). To adopt new server props into local state, use the "previous props in state" pattern (see `NetworkView`). Clear messages *before* `startTransition`, since updates inside a transition only show when it ends.
- **Commands** (from `apps/web`): `npm run dev` (or `preview_start` with name `web`), `npm run lint`, `npm run typecheck`, `npm test` (Vitest, 33 tests), `npm run build`. Extension (from `apps/extension`): `npm run build`, `npm run typecheck`. Installing new web deps may need `--legacy-peer-deps` (vitest 5 conflicted; vitest 4 used).
- **Git:** commit or push only when the user asks; branch off `main` for new work; commit messages end with the Co-Authored-By line from the system prompt.
- **User style:** plain-language updates; the user often steps away and wants autonomous progress with tests; confirm before outward-facing actions (creating cloud resources, sending anything).

## 9. Testing approach (what has worked)

- **Test accounts:** create a confirmed user directly in SQL (Supabase's default SMTP only emails team members). Insert into `auth.users` (instance_id all zeros, `aud`/`role` `authenticated`, `crypt(password, gen_salt('bf'))`, `email_confirmed_at now()`, empty token strings) and `auth.identities`. **Gotcha:** the profile row is created by a trigger, and a CTE in the *same statement* can't see it, so update `profiles` / insert `search_profiles` in a second statement. Email used: `qa-test@offerwing.dev`. **Always delete test users afterwards** (prefer the app's Settings → Delete account so Storage files are removed too).
- **Logging in via the browser pane:** use `find` refs + `type`. Clicking under an emulated viewport (`resize_window` width 1280) mis-targets, so log in at the default size, then resize for screenshots.
- **React-controlled inputs from JS:** set via the native value setter + dispatch `input`/`change` events. Synthetic clicks can't use the clipboard (needs a real click).
- **Fixtures for AI output:** with no AI key, insert a completed run row with a clearly marked "UI TEST FIXTURE" result to verify rendering, then delete it.
- **Fake key for error paths:** temporarily add `OFFERWING_STARTER_ANTHROPIC_API_KEY=sk-ant-api03-FAKE…` to `.env.local`, restart the dev server, verify the failure path, then remove it.
- **Extension UI without Chrome:** copy `dist/` into `apps/web/public/__ext_test/panel/`, add a `shim.js` that fakes `chrome.storage/tabs/scripting`, load it from the dev server (same origin, so no CORS), seed a session in the fake storage from a password-grant token. **Delete `public/__ext_test` afterwards.**
- **API tests:** get a token with `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` (publishable key as `apikey`) and call `/api/ext/*` with `Authorization: Bearer`.
- **Offline tests:** `npx tsx --conditions=react-server ./file.tmp.mts` for scripts importing `server-only` modules (use `.mts` for top-level await).
- **Live board checks** (read-only public APIs) confirmed Greenhouse (Stripe), Lever (Palantir, Spotify) and Ashby (Linear) formats.

## 10. Known environment issues

- **`gh` CLI is not logged in.** `~/.config` is owned by **root**, so `gh auth login` "succeeds" but can't save (`mkdir ~/.config/gh: permission denied`). Fix: the user runs `sudo chown -R "$(whoami)" ~/.config` (their first attempt failed on the password), then `gh auth login`. Workaround tried: `GH_CONFIG_DIR="$HOME/.gh"` login; it was never completed. The assistant's sandboxed shell can't read the macOS keychain anyway, so `gh` commands must run in the user's terminal (`run_in_terminal`). `git push` over HTTPS works from the sandbox.
- A stray `/Users/pulkitsrivastava/package-lock.json` makes Next print a Turbopack root warning. Harmless; machine-specific.

## 11. Architecture opinion recorded (GraphQL / Neo4j)

- **GraphQL:** not useful now. Only first-party clients, server components/actions plus six extension endpoints, and RLS enforced in Postgres. Revisit for a public API or mobile app, and even then use Supabase `pg_graphql` (respects RLS) rather than a custom server.
- **Neo4j:** not useful now. The data isn't multi-hop (the export has 1st-degree only; no scraping); per-user graphs are small and isolated; all queries are one hop (indexed `company_key`). It would add a second datastore with **no RLS**, dual-delete compliance risk and cost in a free product. Revisit for an opt-in cross-user referral network, a shared skills/roles knowledge graph, or measured Postgres path-query performance problems; consider a Postgres graph extension first.
- **Recommended instead (not built):**
  1. **2nd-degree "via a mutual" paths in Postgres:** the extension captures "N mutual connections" names on pages the user opens, stored as edges; 2–3 hop paths with recursive CTEs.
  2. **pgvector** semantic matching: job↔resume similarity, similar roles, duplicate jobs, skill synonyms.

## 12. What's left (priority order)

0. **Review and commit** the `feature/autofill-packets-orgs-marketplace` branch, then open a PR.
1. **Live AI run and prompt tuning** for every agent (now including form answers, referral packets and talent profiles). Needs `OFFERWING_STARTER_ANTHROPIC_API_KEY` in `apps/web/.env.local`. Also verify OpenAI/Gemini model names if those providers are used.
2. **Real-LinkedIn test of the extension:** `chrome://extensions` → Developer mode → Load unpacked `apps/extension/dist` → connect at `/extension/connect`. Tune `extract.ts` selectors against live pages.
3. **Real forwarded LinkedIn alert email** to validate `job-alerts.ts` (tested only on realistic samples).
4. **Check CI** on GitHub Actions (first run never inspected).
5. **Production setup:** Vercel (root `apps/web`), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, inbound-email provider (Postmark/SendGrid) + MX for `alerts.<domain>` + `INBOUND_EMAIL_SECRET`, Google and LinkedIn OAuth providers, production SMTP (e.g. Resend), Supabase auth URLs, domain purchase and trademark search.
6. **Launch items:** legal review of `/privacy` and `/terms`, Chrome Web Store listing (build with `OFFERWING_APP_URL=https://<domain>`), observability (Sentry, AI spend per user), evals per agent.
6b. **B2B operations:** a staff tool (or SQL runbook) to verify recruiting teams and set `seat_limit` / `sponsorship_ends_at`; legal pages to cover organizations, sponsorship, packets and the marketplace; try autofill on real ATS forms (Workday especially).
7. **Next feature options:** mutual paths (section 11.1), pgvector (11.2), LinkedIn Posts API publishing (needs a LinkedIn app), email digest of the weekly plan, extension "insert draft into composer" and own-profile audit view.
