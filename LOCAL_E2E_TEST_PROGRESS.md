# Local end-to-end test progress

Started: 2026-10-27. Goal: run Offerwing locally and test every workflow end to end.

Legend: ✅ passed · ❌ failed · ⚠️ passed with issues · ⏳ pending · 🚫 blocked

## Environment

| Item | Status | Notes |
|---|---|---|
| Node | ✅ | System node is 18.20.2 (too old; app needs 20.9+). Using Homebrew `node@24` 24.17.0 via PATH: `export PATH=/opt/homebrew/Cellar/node@24/24.17.0/bin:$PATH` |
| Homebrew installs | ⚠️ | `~/.gitconfig` sets `http.sslBackend=schannel` (Windows-only), so brew taps fail to clone. `brew install node@22` also failed to link `ca-certificates`. Worked around with the existing node@24. |
| Supabase backend | ✅ | **Production project** (user's choice). Read-only probe confirmed 0018 + 0019 are already applied, so no schema change. Prod requires email confirmation, so test users were created with the admin API (pre-confirmed, no email sent). |
| Test users | ✅ | 4 `+owtest` users created in prod; ids in `/tmp/ow-e2e/users.json`. To be deleted at the end. |
| `.env.local` | ⚠️ | Supabase URL/keys set. `SUPABASE_DB_URL` holds the https project URL, not a `postgresql://` string (not needed now). No AI keys, `INBOUND_EMAIL_SECRET` or `CRON_SECRET` yet. |
| Dev server | ✅ | `next dev -H 127.0.0.1 -p 3100` (port 3000 is used by Kiro); confirmed listening on 127.0.0.1 only |
| AI keys | ⏳ | User will add OpenAI and Anthropic keys later |
| Playwright | ✅ | Installed in `/tmp/ow-e2e` with Chromium; test scripts `w01-*.mjs`, `w02-*.mjs`, screenshots in `/tmp/ow-e2e/shots/` |
| Test data | ✅ | Synthetic set in `e2e/fixtures/` (see below). User may also supply a real resume + LinkedIn export ZIP. |

## Static checks (no backend needed)

| Check | Status | Notes |
|---|---|---|
| `apps/web` npm ci | ✅ | |
| `apps/web` unit tests | ✅ | 17 files, 112 tests passed |
| `apps/web` typecheck | ✅ | After `npx next typegen` |
| `apps/web` lint | ✅ | |
| `apps/extension` typecheck | ✅ | |
| `apps/extension` build | 🚫 | Needs Supabase URL/key (from `apps/web/.env.local`) |
| `apps/extension` tests | — | No test script defined |
| `apps/web` production build | ✅ | 37 routes compiled (placeholder Supabase env) |
| `apps/web` golden eval (offline) | ✅ | 9/9 |

## Test data (`e2e/`)

- `e2e/fixtures/dummy-data.json`: 4 test users (`+owtest` emails), resume content, onboarding answers, settings, application details, 7 jobs covering edge cases (strong fit, partial fit, sponsorship/on-site conflict, prompt injection, ghost job, excluded company, no description), careers boards, alert-email jobs, LinkedIn connections, outreach targets, STAR story, practice answer, offer, content post, outplacement and recruiting orgs, ATS form expectations. Each item has an `expect` note.
- `e2e/generate-fixtures.mjs`: builds `e2e/fixtures/generated/` (resume PDF + DOCX, LinkedIn profile PDF, LinkedIn export ZIP, Postmark alert-email payload, Greenhouse-style form). Run: `node e2e/generate-fixtures.mjs`.

Verified through the app's own parsers:

| Fixture | Result |
|---|---|
| Resume PDF | ✅ Text extracts (1,719 chars); prefill finds email, phone, LinkedIn, GitHub, 10 years experience |
| LinkedIn PDF | ✅ Text extracts; finds LinkedIn URL and 10 years |
| Resume DOCX | ✅ Text extracts |
| LinkedIn export ZIP | ✅ 8 connections, 7 with company, 24 messages scanned, 3 own positions; email addresses dropped |
| Alert email | ✅ Classified as LinkedIn alert; alias read from recipient; 4 jobs with canonical URLs, company and location |

## Workflows

| # | Workflow | Status | Notes |
|---|---|---|---|
| 1 | Landing page, signup, login, signout | ✅ | 17/17. Landing/privacy/terms 200; signed-out guards on /dashboard, /onboarding; password min length; friendly wrong-password error; new user → onboarding; signed-in /login redirects; POST sign-out ends session (GET is 405 by design); bad callback code → error. Sign-up form not submitted (would send a bounced confirmation email from prod). |
| 2 | Onboarding (resume upload + prefill, basics, AI setup, connect) | ✅ (no-AI path) | 20/20. Upload 3 docs; remove deletes row + storage file; prefill fills name/email/phone/LinkedIn/GitHub/years without AI and explains the AI-only fields; required-field and salary-order validation; search profile saved exactly; too-short and provider-rejected OpenAI keys refused and not stored; Starter; alert address; done → dashboard; second user skips documents. **AI prefill of roles/seniority/location still to test with keys.** |
| 3 | Settings: application details, AI mode/keys (Starter / Always-on OpenAI / Anthropic), export, delete account | ✅ (no-AI parts) | Goals/AI summary reflect onboarding; LinkedIn plan, InMail, dream + avoided companies, writing samples saved; salary-order validation; daily minutes saved; application details saved (website gets `https://`; email blocked by browser validation); title exclusions de-duplicated + lower-cased; export JSON has the user's data, no vault id, 401 when signed out; delete button disabled until exactly `DELETE`. **Still to test: Always-on keys (OpenAI, Anthropic), provider switching, actual account deletion (at cleanup).** |
| 4 | Profile Optimizer audit | ⏳ | |
| 5 | Jobs: add job, Job Match scoring, gates, kanban stages | ✅ (no-AI parts) | 7 fixture jobs added; link without `https://` rejected; no-description job stored as null; without an AI key every add says "Added, but couldn't score it: Starter credits aren't available right now…"; "Score 6 jobs" counts only jobs with descriptions; no `job_matches` rows and no Starter runs consumed when nothing could start; drag-and-drop (Saved → Interviewing) saves stage + `stage_changed_at`, survives reload; form stage walk to Offer with channel and next step; overdue next step shown in red; editing the description clears the fit score; Rejected goes under Closed; delete after confirm. Found B3. **Scoring itself, gates' conflicts, prompt-injection and ghost-job handling need AI keys.** |
| 6 | Job discovery: careers-page sources, inbound alert email webhook, inbox | ✅ | Careers pages: non-ATS link refused with guidance; unknown board → "wasn't found"; Greenhouse Stripe 140 of 715 postings matched; Ashby Ramp 32; Lever Spotify followed; duplicate follow refused; Check now adds no duplicates; title exclusions respected; "Only my target roles" toggle saves both ways; Stop following removes the source. Webhook: 401 without or with wrong secret; header secret also accepted; non-alert address and unknown alias ignored; non-JSON → 400; alert adds Mercury + Brex staff roles, skips Shadyco (avoided) and the Sales role (title exclusion); links stored without tracking; re-sent alert adds 0; Gmail forwarding code shown in Settings; only metadata stored. Inbox: count matches DB (200); Dismiss and Save work. Found B1, B2. |
| 7 | Application kit + truthfulness check + .docx download | ⏳ | |
| 8 | Network: LinkedIn export import, Referral Scout, referral asks | ✅ (no-AI parts) | 21/21. Import of the export ZIP completes (8 connections, 7 with company, 3 own positions, no emails stored); Stripe ranked Taylor 85 (EM, 6 messages) > Morgan 65 > recruiter Riley 25; dream companies Plaid/Ramp listed; own employer not a target; search by company works, `%` alone returns nothing; Add → referral list (`to_ask`); re-import keeps ids and list entries; manual contact with link validation; delete imported connections keeps list entries; import again works. Draft ask without AI → clear message. **Drafted asks need AI.** |
| 9 | Referral packets (create, publish, public `/r/[token]`, resume, revoke) | ⏳ | |
| 10 | Outreach queue (follow-ups, connection notes, sent tracking) | ✅ (no-AI parts) | Follow-up due (Taylor), ready-to-ask (Morgan), recruiter to connect (Riley), weekly invite budget; "They replied → Agreed to refer" sets status and clears the follow-up; Stop clears a follow-up. Draft without AI → clear message. **Drafts + "I sent it" tracking need AI.** |
| 11 | Content plan, drafts, comment ideas | ✅ (no-AI parts) | Manual post idea saved (hook, date, pillar, angle, body). Plan, draft and comment ideas without AI → clear message. **Generation needs AI.** |
| 12 | Interviews: story bank, prep pack, practice feedback | ✅ (no-AI parts) | Story requires a title; STAR story saved with competencies; per-job prep page renders with rounds and practice questions; unknown job id → 404. "Rebuild from resume", prep pack and practice feedback without AI → clear message. **Generation needs AI.** |
| 13 | Offers + negotiation plan | ✅ (no-AI parts) | Offer saved with all fields and linked to the pipeline job. Negotiate without AI → clear message. **Plan needs AI.** |
| 14 | Career Coach weekly plan (Today page) | ⚠️ | Today renders greeting, inbox count (198), active/interviewing/offer/referral stats, overdue due item, setup checklist 4/5. Found B4. **"Plan my week" needs AI.** |
| 15 | Insights + calibration | ✅ | Funnel (8 tracked, 3 applied, 2 screen, 2 interview, 1 offer), response rate by channel (referral 1/1), "2 applied jobs have no channel", calibration says too early with 0 scored applications. |
| 16 | Talent marketplace (opt-in profile, recruiter search, intro request/accept) | ✅ (profile written directly, AI build untested) | Unverified team can't search; verified team finds the profile by skills; result has no name/email/user id/evidence quotes; remote-only filter; hidden from a team named after the current employer (search and intro); renaming a verified team removes verification; intro request → no contact details until accepted → candidate sees it on Talent page → Accept creates a Saved `marketplace` job → team sees name/email/LinkedIn/phone; answered intro can't be re-answered; duplicate intro refused; candidate can't write intro rows; hiding the profile removes it from search. Found B5. **"Build my profile" (AI + redaction) still to test.** |
| 17 | Organizations: outplacement (invites, seats, sponsored key), recruiting | ✅ (sponsored key untested) | Console works without onboarding; name length and invite-days validation; default 10 seats; website normalized; owner can't raise seats, set verified or sponsorship date, or read the vault id; anonymous invite preview with sign-up/log-in; bad, used-up and revoked invites show "This invite isn't valid"; member join → `/dashboard?joined=1`, sharing off by default; seat limit enforced (members use seats, owner doesn't); member can't create invites, rename or list members; progress totals hidden under 5 members; member sees Program section in Settings; invalid org key refused. **Valid sponsor key + member running on it needs an AI key.** |
| 18 | Starter limits ledger (claim / release / daily cap) | ⚠️ partial | User can't insert usage, raise limits or call `release_starter_runs`; `starter_runs_left` = 2 audits. **Claims and give-back on failure need an AI key.** |
| 19 | Cron routes (discovery, cleanup) | ✅ (auth only, by choice) | Both return 401 without or with a wrong `CRON_SECRET`. Not run against prod: discovery would poll every real user's careers pages with this uncommitted code, and cleanup purges real users' stale data. |
| 21 | Data isolation between users (RLS, storage, privileged RPCs) | ✅ | 48/48. Second user and anon see none of the first user's rows in 25 tables; can't update/delete/insert their jobs; can't change own `alert_alias` or write `ai_settings`; can't download, list or upload in their storage folder; bucket isn't public; `get_user_ai_key`, `release_starter_runs`, `purge_stale_data` denied; extension API needs a valid token and returns only the caller. |
| 20 | Browser extension (connect, side panel, autofill on ATS form, Private mode) | ✅ (autofill + connect) | 18/18. Built with `OFFERWING_APP_URL=http://127.0.0.1:3100`, loaded in Chromium; pinned ID `mgoonaiikahlemfjhcdgpdgjmkjjbmbc`; signed-out panel offers Connect; `/extension/connect` hands over the session; session survives reload. On a Greenhouse form (fixture served at a `boards.greenhouse.io` URL): scan → "Fill 9 fields"; fills name, email, phone, city, LinkedIn, work authorization "Yes", sponsorship "Yes" (from preferences), attaches the resume; keeps a user-typed value; lists gender/race/veteran and consent under "Left for you" and leaves them untouched; never submits. Draft answers without AI → clear message. Test shim: `chrome.tabs.query` returns the form tab (a panel opened as a tab would otherwise see itself). **Still to test: LinkedIn page analysis (needs real LinkedIn pages), Private mode (needs a key), "I submitted it: mark as applied".** |

## Issues found

| ID | Severity | Where | What happens | Evidence |
|---|---|---|---|---|
| B1 | Medium | `addJobSource` → `pollSources` (`lib/discovery.ts:94`) | When the first poll of a newly followed board fails, `pollSources` swallows the error, so the user sees a success message: "Following Ramp: 0 matching jobs added to your inbox." The board then shows the raw error "TypeError: fetch failed" under it. The user believes Ramp has no matching jobs; the next "Check now" found 32. | Ashby `ramp`, first follow |
| B3 | Low | `JobsBoard.tsx:259-264` (new job `onSaved`) | Adding a job at a company on the avoid list (or one already being scored) shows no message at all. `queueJobMatches` returns the skip reason, but the add-job handler only looks at `error` and `queued`. The user doesn't know why it has no score. ("Score N jobs" does show reasons.) | Added "Staff Engineer" at Shadyco Staffing on a fresh page: no message |
| B4 | Low–Medium | Today page, `app/dashboard/page.tsx:79` | "Referral opportunities" says "You don't know anyone at Mercury yet" (and Ramp) although the imported LinkedIn connections include Avery Johnson (Head of Engineering, Mercury) and Jamie Silva (Ramp), and Referral Scout lists them. The check only looks at the referral list (`contacts`), not imported `connections`. | Seeker with 8 imported connections |
| B5 | Medium | `0015_talent_marketplace.sql:38-43` (RLS "own talent profile: all" + column grants) | A signed-in user can insert or update their own `talent_profiles` row directly through the Supabase API with any headline, summary, skills, highlights, `verification` and `status = 'draft'`, then set `visible = true`. This skips everything the app does: the AI build that keeps only skills found in the documents, deterministic redaction, `saveTalentProfile`'s identifying-details check and edit schema, and `setTalentVisibility`'s checks. Verified recruiters then see an unverified profile presented as "fact-checked". Same pattern as the Starter-usage issue fixed in 0018: users write the rows the guarantee depends on. Fix: revoke direct insert/update and go through security-definer functions (or a trigger that refuses user-set `status`/`verification`/`skills`). | Inserted a visible profile as the seeker with the publishable key; a verified team found it |
| B2 | Low | `getJson` (`lib/job-sources.ts:36`) | One attempt with a 15 s timeout. On a slow or spiky connection the user sees the raw "The operation was aborted due to timeout" (or "TypeError: fetch failed") instead of a friendly message, and no retry. | Lever `spotify` timed out once, worked on retry; direct fetch times ranged 150 ms–3.8 s on this network |

## Fixes (2026-10-27)

| ID | Status | Change |
|---|---|---|
| B1 | ✅ Fixed, verified | `addJobSource` reuses the board it already fetched instead of fetching it a second time (the second fetch was what failed for Ramp). `pollSources` now returns `failed`; following a board whose jobs couldn't be added says "Now following X, but couldn't add its jobs yet: … Use "Check now" to try again." "Check now" says how many boards couldn't be read. Files: `lib/discovery.ts`, `app/dashboard/jobs/discovery-actions.ts`, `components/dashboard/JobSources.tsx`. |
| B2 | ✅ Fixed | `getJson` retries once (after 1 s) on network errors, timeouts, 429 and 5xx, and shows "Couldn't reach the careers board just now. Try again in a minute." instead of raw errors. File: `lib/job-sources.ts`. |
| B3 | ✅ Fixed, verified | One `scoreSaved` helper for "Add job" and inbox "Save & score": shows the skip reason (e.g. "Added, but couldn't score it: Shadyco Staffing is on your companies-to-avoid list"). File: `components/dashboard/JobsBoard.tsx`. |
| B4 | ✅ Fixed, verified | Today also counts imported LinkedIn connections (by `company_key`) for saved jobs with no one on the referral list: "You have 1 LinkedIn connection at Mercury. See who to ask for a referral." File: `app/dashboard/page.tsx`. |
| B5 | ⚠️ Code done, **migration not yet applied to prod** | New `supabase/migrations/0020_talent_profile_writes.sql`: users keep read + delete on their talent profile; insert/update revoked. Server actions (`app/dashboard/talent/actions.ts`) write with the service-role client after their checks. Apply order: deploy the code first (works with or without 0020), then apply 0020. README updated. |

Checks after the fixes: typecheck ✅, lint ✅, unit tests 112/112 ✅, all 20 migrations apply on PGlite ✅.

## Observations (not bugs, worth a look)

- Dismissed inbox jobs are listed under "Closed" with rejected and withdrawn ones (`JobsBoard.tsx:80`), so a user who dismisses 50 inbox jobs gets a "Closed (50)" pile.
- The jobs page loads every job, including the inbox, in one query. Following a few large boards gave this user 200 jobs quickly; Supabase's default 1,000-row cap would silently cut off the board past that.
- The careers-board "Only my target roles" checkbox has no local state, so it visibly changes only after the server round trip (~0.65 s).
- `/auth/callback` redirects to `localhost` even when the app was opened on `127.0.0.1`, so in local dev the session cookie is on the other host. Production is unaffected.

## Log

- 2026-10-27: Surveyed repo, set up Node 24, ran static checks (all green). Blocked on backend choice and Docker.
- 2026-10-27: Production build and offline eval green. Created synthetic fixtures and verified them against the real parsers. Waiting on Supabase URL / publishable key / service-role key / DB URL and AI keys in `apps/web/.env.local`.
- 2026-10-27: Got prod Supabase credentials. Confirmed schema is current (read-only). Created 4 `+owtest` users. Ran every workflow up to the AI call: auth, onboarding, settings, job sources, alert webhook, inbox, pipeline, network, outreach, interviews, offers, content, insights, Today, data isolation, organizations, talent marketplace, extension autofill. Added local-only `INBOUND_EMAIL_SECRET` and `CRON_SECRET` to `.env.local`. Found B1–B5. Next: add AI keys and rerun the AI parts (see "Waiting on AI keys").

## Waiting on AI keys

Add `OFFERWING_STARTER_OPENAI_API_KEY` and `OFFERWING_STARTER_ANTHROPIC_API_KEY` to `apps/web/.env.local`. Then:

1. Onboarding AI prefill (roles, seniority, industries, location)
2. Profile Optimizer audit (and 2/day Starter limit, give-back on failure)
3. Job Match on the 6 fixture jobs: strong vs partial fit, sponsorship + on-site conflicts from the code gate, prompt-injection report, ghost-job legitimacy, excluded company skipped
4. Application kit + truthfulness check + `.docx` download
5. Referral asks, follow-ups, connection notes, "I sent it"
6. Referral packet: create, publish, public `/r/[token]`, resume download, view count, revoke
7. Content plan, post draft, comment ideas
8. Story bank from resume, prep pack (with web research on Anthropic), practice feedback
9. Negotiation plan (no invented competing offers)
10. Career Coach weekly plan
11. Talent profile build (redaction, only skills from documents)
12. Always-on mode with each key (Vault storage, `…last4` only), provider switch, back to Starter deletes the secret
13. Sponsored outplacement key → member runs on it as `cloud`
14. Extension Private mode and form-answer drafts

## Cleanup (at the end)

Test data lives only under the 4 `+owtest` users (ids in `/tmp/ow-e2e/users.json`) and the 3 test organizations they created. Plan: delete account through the UI for the seeker (tests the real flow, including storage file removal), then delete the remaining users and organizations with the admin API, then confirm no rows or files remain.
