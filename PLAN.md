# Offerwing — AI Job-Search Agents (System Plan)

> Product name: **Offerwing** (offerwing.ai). Tagline draft: "Your AI wingman from profile to offer."

> Goal: a team of AI agents that runs a job seeker's entire LinkedIn job hunt — profile, discovery, applications, networking, content, interviews and offers — with the human approving anything that is sent, posted or submitted.

---

## 0. Constraints to design around first

These decide the architecture more than any feature does.

| Constraint | What it means | How we design for it |
|---|---|---|
| **LinkedIn User Agreement §8.2** bans bots, scrapers and automated activity on the site | Headless-browser bots that auto-apply, auto-connect or auto-message get accounts restricted or banned. That is the main failure mode for tools in this space. | **The agents decide and draft; the user acts.** Nothing clicks Send, Connect or Apply on its own. |
| **The official API is narrow** | A normal developer app can use *Sign In with LinkedIn (OIDC)* and *Share on LinkedIn* (`w_member_social`: create posts). There are no public Jobs, People Search or Messaging APIs; those need partner programs. | Use the API only for identity and posting. Get everything else from compliant sources (below). |
| **Compliant data sources** | • LinkedIn **job-alert emails** (read through the Gmail/Outlook API)<br>• LinkedIn **data export** (Settings → Data privacy → Get a copy of your data): connections, messages, profile, applications, saved jobs<br>• Public **ATS job boards**: Greenhouse, Lever, Ashby and Workable all expose public JSON<br>• Pages the user pastes, or opens themselves (an optional read-only browser extension) | These cover about 90% of what the agents need without breaking the ToS. |
| **Platform limits** | Roughly 100 connection invites a week. Free accounts get only a few personalized invite notes a month. InMail needs Premium credits. | The Outreach agent plans inside these budgets and ranks targets so each invite counts. |
| **Truthfulness** | Tailored resumes must never invent experience. | A grounding check: every resume claim must trace back to the Career Knowledge Base. |

---

## 1. LinkedIn features a job seeker uses

### 1.1 Profile (the recruiter-search surface)
- **Photo and banner.** Profiles with a photo get far more views. The banner is free advertising space for the value proposition.
- **Headline** (220 chars). This is the biggest ranking factor in recruiter search, so it should be keyword-dense: *Role | Specialty | Proof point*.
- **About** (2,600 chars). Keywords, story, achievements, and a call to action with contact details.
- **Experience.** Title, company, dates, description, and a **skills tag per role**. Media attachments are supported.
- **Skills** (up to 100). The top 5 carry the most weight in search and job matching. Endorsements support them.
- **Featured section.** Portfolio, case studies, posts, links.
- **Open to Work** has two modes: *Recruiters only* (hidden from your employer's recruiters, not guaranteed) or *All members* (the green #OpenToWork frame). It holds job titles, locations, remote/onsite, start date and employment types.
- **Job preferences.** Titles, locations, workplace type, salary. These drive job recommendations.
- **Recommendations** (given and received), **Licenses & certifications**, **Projects**, **Courses**, **Honors**, **Languages**, **Volunteering**, **Publications**, **Patents**.
- **Custom public URL**, **multi-language profiles**, **verification badges** (identity, workplace), **pronouns**, **name pronunciation**, **contact info**.
- **Services page** for freelancers and consultants.
- **Profile analytics.** Profile viewers, search appearances and the keywords that surfaced you. Full history needs Premium.

### 1.2 Jobs
- **Job search** with filters: date posted, experience level, company, job type, remote/hybrid/onsite, **Easy Apply**, **Under 10 applicants**, **In your network**, salary, industry, function, title, benefits, "Fair chance employer", verified jobs.
- **Boolean search** in the keyword box: `AND`, `OR`, `NOT`, `"exact phrase"`, `()`.
- **Natural-language AI job search** (rolling out, e.g. "remote PM roles in fintech").
- **Job alerts.** Saved searches with daily or weekly email and push notifications.
- **Saved jobs** and **My Jobs** (Saved / In progress / Applied / Archived).
- **Easy Apply.** One-click apply with a stored resume, contact info and screening answers.
- **Company-site apply** (goes to the external ATS).
- **Job match signals.** Skills match, "You'd be a top applicant", "Actively reviewing applicants", "Promoted", number of applicants. Premium adds applicant insights such as seniority and education mix.
- **Resume storage.** Several resumes held in apply settings.
- **Share profile with recruiters** during Easy Apply.
- **Hiring team / job poster** card on the post: who posted it, and a way to message them.

### 1.3 Networking
- **Connections** (1st/2nd/3rd degree), **invitations with a note**, **Follow** (no mutual accept needed).
- **People search** with filters: current/past company, school, location, industry, connection degree, "Open to" and more. Boolean works in keywords.
- **Company page → People tab**, filterable by what they studied, what they do, and where they live. This is how you find the hiring manager and team.
- **Alumni tool** (School page → Alumni), a warm-intro goldmine.
- **Messaging.** Only with 1st-degree connections, or via **InMail** (Premium credits) or **Open Profile** members.
- **Groups**, **Events** (attend and network with attendees), **Newsletters** (subscribe to people in your target space).
- **Referral requests.** The "In your network" signal on jobs shows who can refer you.

### 1.4 Content and personal brand
- **Posts** (text, images, **document/carousel**, video, polls), **Articles**, **Newsletters**.
- **Comments.** The highest-leverage visibility action for job seekers, because they put you in front of hiring managers' audiences.
- **Reposts**, **reactions**, **hashtags and mentions**, **scheduling posts**.
- **Post analytics.** Impressions, audience demographics, followers.
- Former "creator mode" features (Follow as the primary button, topic hashtags) are now default for everyone.

### 1.5 Company intelligence
- **Company pages.** About, employee count and growth, Life tab, Jobs tab, posts, recent hires.
- **Premium company insights.** Headcount growth by function, hiring trends, attrition, notable alumni.
- **Salary insights** on job posts and the Salary tool.

### 1.6 Learning and credibility
- **LinkedIn Learning** courses, whose certificates can be added to the profile.
- **Verified certifications** from partners.
- (Skill assessments were retired in 2023, so don't build on them.)

### 1.7 Premium Career (optional tier)
- InMail credits, **Who viewed your profile** (full 90-day history), **Top Applicant** jobs, **applicant insights**.
- **AI features:** profile-writing suggestions, "assess my fit" for a job, message and cover-letter drafts, interview-prep help. Our agents replace or augment these.

### 1.8 Settings that matter during a search
- **Share profile updates with your network**: turn it off before bulk profile edits.
- **Profile viewing mode** (public / semi-private / private) when researching people.
- **Who can see your connections**, **Open to Work visibility**, **job-seeking preferences** ("Signal your interest to recruiters at companies you've created job alerts for").
- **Data export**: the feed for our agents.

---

## 2. Agent architecture

```
                         ┌──────────────────────────┐
         User (chat/UI) ─►   Orchestrator / Career   │  plans the week, routes tasks,
                         │   Coach Agent            │  owns goals & priorities
                         └────────────┬─────────────┘
       ┌──────────────┬──────────────┼──────────────┬───────────────┬──────────────┐
       ▼              ▼              ▼              ▼               ▼              ▼
  Profile        Job Discovery   Application    Networking &    Content &      Interview &
  Optimizer      & Matching      Tailoring      Outreach        Brand          Offer
       │              │              │              │               │              │
       └──────────────┴──────┬───────┴──────────────┴───────────────┴──────────────┘
                             ▼
     Shared services: Career Knowledge Base · Company Research · Tracker/CRM ·
                      Guardrail & Approval Queue · Analytics
```

### Agent roster

| # | Agent | Mission | Autonomy |
|---|---|---|---|
| A0 | **Orchestrator / Career Coach** | Turns goals into a weekly plan, routes work, runs the daily brief and weekly review | Auto (planning only) |
| A1 | **Career Intake & Knowledge Base** | Builds the single source of truth: every role, project, metric, skill and story | Auto + user confirms facts |
| A2 | **Profile Optimizer** | Audits and rewrites the LinkedIn profile for target roles and recruiter search | Draft → approve |
| A3 | **Job Discovery** | Pulls jobs from alerts, ATS boards and pasted links; dedupes; enriches | Auto |
| A4 | **Job Match & Prioritizer** | Scores fit, flags gaps and red flags, ranks the daily shortlist | Auto |
| A5 | **Application Tailoring** | Tailored resume, cover letter, screening answers and "why us" | Draft → approve |
| A6 | **Company Research** | Company brief: product, funding, news, culture, team, interview process | Auto |
| A7 | **Networking & Outreach** | Finds referrers, hiring managers and alumni; drafts invites, DMs and follow-ups | Draft → approve (never auto-send) |
| A8 | **Content & Brand** | Content calendar, post drafts, comment suggestions on target people's posts | Draft → approve (posting via API is allowed) |
| A9 | **Tracker / CRM** | Pipeline state for jobs, contacts and conversations; reminders and follow-up SLAs | Auto |
| A10 | **Interview Prep** | Likely questions, STAR stories from the KB, mock interviews, feedback | Interactive |
| A11 | **Offer & Negotiation** | Comp benchmarking, offer comparison, negotiation scripts | Draft → approve |
| A12 | **Guardrail & Compliance** | Enforces ToS-safe behavior, rate budgets, the truthfulness check, PII | Always-on gate |
| A13 | **Analytics & Learning** | Funnel metrics; A/B tests on headlines and messages; feeds lessons back to the other agents | Auto |
| A14 | **Referral Scout** | For every target company and job, finds and ranks the people who could refer the user (1st-degree, 2nd-degree via mutuals, alumni, ex-colleagues) and plans the ask | Auto (analysis) + draft → approve (messages) |

---

## 3. Task list by agent

Legend: **[A]** fully automatic · **[D]** agent drafts, user approves · **[H]** user does it, agent guides and reminds

### A1: Career Intake & Knowledge Base
- [A] Import the resume(s), the LinkedIn data export ZIP, portfolio, GitHub and past performance reviews.
- [A] Extract structured data: roles, dates, teams, projects, tech stack, metrics, awards.
- [D] Interview the user to fill gaps: "What was the impact of project X? Numbers?"
- [A] Build a **STAR story bank** (15–25 stories tagged by competency: leadership, conflict, failure, scale, ambiguity).
- [D] Define **target personas**: 1–3 role titles, seniority, industries, locations, remote preference, salary floor, deal-breakers, dream companies.
- [A] Build a **keyword map** for each target role from 50+ job descriptions: must-have skills, nice-to-haves, and the language recruiters use.
- [A] Keep the KB versioned. Every later claim must be grounded in it.

### A2: Profile Optimizer
- [A] **Profile audit score** (0–100) per section against the target persona and keyword map.
- [D] Headline: 5 variants (keyword-first, value-prop, proof-point); A/B tested over time.
- [D] About section: hook, story, achievements with metrics, keywords, call to action.
- [D] Experience bullets rewritten per role, metric-led, with 3–5 bullets each and a skills tag per role.
- [D] Skills: pick and order the top 5 pinned skills, fill to about 50 relevant ones, remove noise.
- [D] Featured section: choose 3–5 items (case study, post, portfolio, certificate).
- [D] Open to Work: titles (up to 5), locations, workplace types, start date, visibility mode.
- [D] Job preferences and "signal interest to recruiters" settings.
- [D] Custom URL suggestion; banner copy and design brief; photo checklist.
- [D] Recommendation requests: pick the best 3–5 people and draft a personalized ask that suggests the points to cover.
- [D] Recommendations to *give*, since reciprocity drives reciprocity.
- [H] Checklist: turn off "share profile updates" before editing, verify identity and workplace, add a pronunciation.
- [A] **Monthly re-audit** against the latest job descriptions; track search appearances and profile-view trends.

### A3: Job Discovery
- [D] Design **LinkedIn job-alert search strings** (Boolean) per persona. The user saves them as alerts.
- [A] Parse **job-alert emails** (Gmail/Outlook API) into structured job records.
- [A] Poll **public ATS boards** (Greenhouse, Lever, Ashby, Workable) for the target-company list.
- [A] Accept **pasted job URLs or JDs** from the user or the browser extension.
- [A] Dedupe across sources (same role on LinkedIn and the company ATS).
- [A] Enrich each job: salary estimate, seniority, remote status, visa sponsorship mentions, posting age, applicant count if visible.
- [A] Flag **"hidden jobs"**: hiring-manager posts saying "we're hiring" (from content the user shares).
- [A] Maintain a **target company list** (dream / good / backup) and watch their Jobs pages.

### A4: Job Match & Prioritizer
- [A] **Fit score** (0–100): skills overlap, seniority, domain, location, comp, and deal-breakers.
- [A] **Gap analysis** per job: missing keywords, and which KB evidence could cover them.
- [A] **Priority score** = fit × freshness (under 72h is best) × network leverage (1st/2nd-degree at the company) × company tier.
- [A] Red-flag detection: ghost-job signals, reposted forever, vague comp, scam patterns (payment requests, off-platform chat only).
- [A] **Daily shortlist** of the top N jobs, each with a recommended channel: *referral first* / *hiring manager DM* / *Easy Apply* / *company site*.

### A5: Application Tailoring
- [D] **Tailored resume** per job: reorder bullets, mirror JD keywords, keep it ATS-safe (single column, standard headings), export PDF/DOCX.
- [A] **Truthfulness check**: every bullet maps to a KB fact, with fabrications blocked (via A12).
- [A] **ATS match report**: keyword coverage %, formatting warnings.
- [D] **Cover letter** or short "note to hiring manager" (150–250 words, specific to the company).
- [D] **Screening answers**: years of experience per skill, work authorization, salary expectation (strategy-aware), notice period, custom questions. Keep a reusable answer bank.
- [H] The user submits (Easy Apply or company site). The agent keeps a pre-filled answer sheet side by side.
- [A] Log the application in the Tracker with the exact resume version used.

### A6: Company Research
- [A] One-page brief: what they do, business model, funding and stage, headcount trend, recent news, leadership, competitors.
- [A] Team map: likely hiring manager, team members, recruiters (from what the user views or pastes).
- [A] Culture signals: Life tab, employee posts, Glassdoor-style themes (the user supplies the content).
- [A] Interview-process intel: stages, typical questions, take-home or not.
- [A] "Why this company" talking points linked to the user's stories.

### A7: Networking & Outreach (the biggest lever)
- [A] **Warm paths come from A14 Referral Scout**; A7 turns its ranked list into outreach.
- [D] **Referral request** drafts with the job link, a 2-line fit summary, and the resume attached.
- [D] **Hiring manager / recruiter outreach**: invite note (under 200 chars for the note limit) and a follow-up after they accept.
- [D] **Alumni outreach** for informational interviews.
- [D] **Follow-up sequences**: day 3–5 nudge, day 10 value-add, then stop. Never more than two follow-ups.
- [D] **Thank-you notes** after coffee chats and interviews.
- [D] **Network maintenance**: congratulate job changes and birthdays, share relevant articles, reconnect with dormant ties.
- [A] **Budget manager**: plans about 15–20 invites a day within the ~100/week cap, tracks note quota and InMail credits, and ranks targets by expected value.
- [A] Track acceptance and reply rates per template; feed the results to A13.
- [H] The user sends every message and invite. The agent queues them in "ready to send" with copy buttons and deep links.
- [D] Recruiter relationship management: which agency or in-house recruiters own which roles, and when to check in.
- [D] Event and group networking: suggest relevant LinkedIn Events and Groups, plus pre-event and post-event outreach.

### A8: Content & Brand
- [D] **Positioning statement** and 3–4 content pillars (expertise, learnings, projects, industry takes).
- [D] **Weekly content calendar**: 2–3 posts a week (text, carousel/document, short case study, poll).
- [D] Post drafts in the user's voice (a style profile learned from past writing), with hook variants.
- [D] "Open to work" announcement post, done tastefully, with a specific ask.
- [D] **Comment suggestions**: 5–10 a day on posts by target hiring managers, industry leaders and target companies. Comments must be thoughtful, not "Great post!".
- [A] Publish approved posts via the official **Posts API**, or schedule them.
- [A] Post analytics: impressions, profile visits after a post, new followers; learn which formats work.
- [D] Newsletter or article plan for senior and thought-leadership personas.

### A9: Tracker / CRM
- [A] **Job pipeline**: Discovered → Shortlisted → Tailored → Applied → Screen → Interviews (n) → Offer → Accepted/Rejected/Ghosted.
- [A] **Contact CRM**: person, company, relationship strength, last touch, next action.
- [A] **Follow-up SLAs**: nudge if no response in X days; auto-archive ghosted applications after 30 days.
- [A] **Daily brief** (morning): today's top jobs, messages to send, follow-ups due, interviews, posts to publish, comments to leave.
- [A] Calendar sync for interviews and coffee chats (Google Calendar).
- [A] Import a periodic data export to reconcile with the LinkedIn "Applied" list.

### A10: Interview Prep
- [A] Stage-specific prep packs: recruiter screen, hiring manager, technical, system design, behavioral, case, panel, final.
- [A] Predicted questions from the JD, company intel, and public interview reports.
- [A] Map questions to STAR stories from the KB; find gaps where no story exists.
- [D] "Tell me about yourself" and "Why us / why leaving" scripts per company.
- [A] **Mock interviews** (text or voice) with scoring on structure, specificity, metrics and conciseness.
- [D] Smart questions to ask the interviewer, tailored per interviewer (from their LinkedIn profile).
- [A] Post-interview debrief: what went well, what to fix; feeds the story bank.
- [D] Thank-you emails within 24h.

### A11: Offer & Negotiation
- [A] Comp benchmarking (LinkedIn salary insights, levels data, and user input).
- [A] Offer comparison matrix: base, bonus, equity (with vesting and valuation scenarios), benefits, growth, remote, risk.
- [D] Negotiation strategy and scripts (email and call talking points); counter-offer drafts.
- [D] Decline-gracefully messages that keep the relationship.
- [D] **Post-acceptance tasks**: update the profile (new role, turn off Open to Work), announcement post, thank-you notes to everyone who helped, close out the pipeline.

### A12: Guardrail & Compliance (always-on)
- [A] Block any action that would automate clicks or sends on linkedin.com.
- [A] Enforce rate budgets (invites, messages, comments) at human-normal levels.
- [A] Truthfulness validator on resumes and profiles.
- [A] Tone and safety check: no spam patterns, no mass-identical messages (enforce personalization variance).
- [A] PII handling: encrypt the KB, never place data in URLs, redact before third-party calls where possible.
- [A] Scam and phishing detection on inbound recruiter messages.

### A13: Analytics & Learning
- [A] Funnel: jobs discovered → applied → responses → screens → onsites → offers, **by channel** (referral vs cold vs Easy Apply).
- [A] Outreach metrics: acceptance and reply rates per template and persona.
- [A] Profile metrics: search appearances, views, recruiter InMails received.
- [A] Content metrics: impressions, engagement, and whether posts led to conversations.
- [A] **Weekly review** with the Orchestrator: what's working, what to change, next week's plan.
- [A] Headline and message A/B experiments with significance checks.

### A14: Referral Scout (mutuals → referrals)

**Data sources (ToS-safe):**
- **Connections export** (1st-degree: name, company, title, connected-on date) plus the **messages export** (relationship recency and strength). Re-imported monthly.
- The user's **own history**: past companies and schools (overlapping years), for ex-colleague and alumni matches.
- **Extension, user-triggered:** when the user opens one of these pages and clicks "Find referrers", the side panel reads only what's visible:
  - A job post: the "connections / school alumni work here" module
  - A company page → People tab
  - A people search filtered by *Current company = X* + *2nd-degree*: each result's "N mutual connections" and the named mutuals

  No crawling or auto-pagination; the user scrolls or pages themselves.

**Tasks:**
- [A] **Company referral map**: for each target company, list 1st-degree contacts, 2nd-degree people with the mutuals who bridge to them, alumni, and ex-colleagues.
- [A] **Referral likelihood score** per person:
  - Relationship strength: worked together, overlapping school years, message history, how long connected, last interaction
  - Relevance: same team or function as the job, hiring-manager proximity, seniority, or recruiter
  - Eligibility: tenure at the company (past about 3 months, so referral bonuses usually apply), still employed there
  - Bridge strength (2nd-degree): how well the user knows the mutual, and how many mutuals there are
  - Responsiveness signals: active on LinkedIn, Open Profile
- [A] **Best path per job**: *Direct ask* (1st-degree) → *Intro via mutual* (2nd-degree: pick the strongest bridge) → *Alumni / ex-colleague cold-warm* → *Hiring manager direct*.
- [A] **Job-level alerts**: "3 people you know work at Stripe, which just posted a role matching you 87%: ask Priya first."
- [D] **Referral ask draft** to a 1st-degree contact: short context, job link, why they're a fit, resume attached, and an easy out.
- [D] **Intro request to the mutual**, plus a **forwardable blurb** the mutual can paste to the target person.
- [D] **Thank-you and update** messages after a referral (and a heads-up when the user gets an interview).
- [A] **Referral tracker**: asked → agreed → submitted → outcome, per person and job. Never ask the same person twice for similar roles within N weeks.
- [A] **Freshness checks**: flag contacts whose company or title may have changed (older export, or seen different on a profile view).
- [A] **Privacy**: keep third-party data only for contacts at target companies; auto-purge unused records after 90 days; the user can delete any time.
- **Future (opt-in):** the Offerwing referral network. Users who opt in can volunteer as referrers at their own company for other Offerwing job seekers, with double opt-in introductions.

---

## 4. End-to-end task list (job seeker's journey)

### Phase 1: Foundation (week 1)
1. Define target roles, seniority, locations, comp and deal-breakers. (A1)
2. Build the career KB and STAR story bank. (A1)
3. Build the keyword map from 50+ target job descriptions. (A1)
4. Request the LinkedIn data export. (H)
5. Full profile rewrite: headline, About, experience, skills, featured. (A2)
6. Set Open to Work, job preferences and privacy settings. (A2/H)
7. Create 3 base resumes (one per persona) and an answer bank. (A5)
8. Build a target company list of 30–100 companies in tiers. (A3/A6)
9. Set up 5–10 Boolean job alerts on LinkedIn. (A3/H)
10. Request 3–5 recommendations. (A2/A7)

### Phase 2: Daily engine (every weekday, about 60–90 min of user time)
1. Read the morning brief. (A9)
2. Review the top 5–10 ranked jobs and approve 3–5 to pursue. (A4)
3. For each: find the warm path, send the referral or hiring-manager message, apply with the tailored resume. (A7/A5)
4. Send 10–20 targeted connection invites. (A7)
5. Leave 5–10 thoughtful comments. (A8)
6. Send follow-ups that are due. (A9/A7)
7. Log responses; the agents update the pipeline. (A9)

### Phase 3: Weekly cadence
1. Publish 2–3 posts. (A8)
2. Hold 2–3 informational or coffee chats. (A7)
3. Refresh the target company list and alerts. (A3)
4. Weekly analytics review and strategy adjustment. (A13/A0)
5. Maintain the network: congratulations, check-ins. (A7)

### Phase 4: Interviews
1. Company brief and interviewer research. (A6)
2. Stage-specific prep and mocks. (A10)
3. Thank-you notes within 24h, then a debrief. (A10)
4. Pipeline and next-step reminders. (A9)

### Phase 5: Offer and close
1. Benchmark comp and compare offers. (A11)
2. Negotiate. (A11)
3. Accept or decline gracefully. (A11)
4. Update the profile, turn off Open to Work, post an announcement, thank the helpers. (A11/A8)

---

## 5. Product decisions (locked)

| Decision | Choice | Implication |
|---|---|---|
| Product type | **Multi-tenant SaaS** for many job seekers | Auth, billing, per-user data isolation, cost metering, privacy compliance, LinkedIn/Google app reviews |
| LinkedIn tier | **Captured per user at onboarding** | Tier-aware feature flags (§7) |
| Target domain | **Captured per user at onboarding** | Domain packs for keyword maps, interview prep and content pillars (§6) |
| Surfaces | **Website (web app) + browser extension** | Web = command center; extension = copilot on the LinkedIn page the user is viewing (§9) |

---

## 6. Onboarding / registration flow

The goal is a real first result in under 10 minutes: a profile audit score and a list of the top 5 fixes.

1. **Sign up.** Email magic link, Google, or **Sign In with LinkedIn (OIDC)**, which gives us name, photo and email only.
2. **Import career data** (each step can be skipped, and every extra source improves quality):
   - Upload the resume (PDF/DOCX)
   - Upload the LinkedIn profile PDF (Profile → More → Save to PDF)
   - Upload the **LinkedIn data export ZIP**. Show a guided walkthrough, because LinkedIn takes up to about 24h to prepare it; we email a nudge when it's ready.
3. **Career questionnaire** (branching, about 3 minutes):
   - Target roles (1–3), seniority, **industry/domain** (chooses the domain pack), functions
   - Locations, remote/hybrid/onsite, relocation, **work authorization / visa sponsorship need**
   - Salary floor and target, currency, notice period / earliest start date
   - **Search mode**: *Open* (unemployed or public) vs *Stealth* (currently employed). Stealth disables the #OpenToWork frame, makes outreach wording discreet, and warns about profile-update broadcasts.
   - Urgency (actively applying vs exploring) and **time budget per day** (15 / 30 / 60 / 90+ min), which sizes the daily plan
   - Dream companies and companies to exclude (e.g. the current employer)
   - **LinkedIn plan**: Free / Premium Career / Premium Business / Sales Navigator / Recruiter Lite, plus remaining InMail credits
   - Writing-voice samples (2–3 past posts or emails) for the style profile
   - Languages, and the region used for salary data
4. **Connect job alerts.** Give the user a unique forwarding address (`u_<id>@alerts.<product>.com`) plus a one-click guide to create a Gmail/Outlook filter that forwards LinkedIn job-alert emails to it (see §8 for why we don't use Gmail OAuth at first).
5. **Install the browser extension**, which links to the account automatically.
6. **First results.** Profile audit score, the top 5 fixes, 3 headline variants, and the first ranked job shortlist.
7. **Choose a plan.** Free trial, then paid (Stripe).

Every answer can be edited later in **Settings → Job search profile**, and the agents re-plan when anything changes.

---

## 7. Why the LinkedIn plan matters: tier-aware behavior

The user's LinkedIn tier changes what the agents *can* recommend. Treat the numbers as approximate: LinkedIn changes quotas, so they are stored as config, not hard-coded.

| Capability | Free | Premium Career | Premium Business | Sales Navigator | Agent behavior |
|---|---|---|---|---|---|
| **InMail credits** (message non-connections) | None | ~5/mo | ~15/mo | ~50/mo | A7 spends InMails only on the highest-value targets (hiring managers for top-fit jobs); free users get connect-then-message sequences instead |
| **Personalized invite notes** | Few per month | Effectively unlimited | Unlimited | Unlimited | Free: A7 saves notes for key targets and sends the rest without notes; Premium: every invite gets a note |
| **Who viewed your profile** | Last few viewers | 365 days | 365 days | Yes | Premium: A7 turns profile viewers (e.g. recruiters) into warm leads |
| **Top Applicant jobs / applicant insights** | No | Yes | Yes | Partial | A4 adds competition data (applicant count, seniority mix) to the priority score |
| **Company insights** (headcount growth, hiring trends) | No | Limited | Yes | Yes | A6 briefs include growth signals; A4 boosts fast-growing companies |
| **Open Profile** (anyone can message you free) | No | Yes | Yes | Yes | A2 recommends turning it on for Open-mode searchers |
| **Advanced lead search / saved leads / alerts** | No | No | No | Yes | A7 uses Sales Nav lead lists to find hiring managers precisely |
| **LinkedIn's own AI tools** (fit check, drafts) | No | Yes | Yes | Some | Our agents complement them; we don't duplicate what the user already has |

Because **you have Premium** and will be the first user, the MVP can be tested on the Premium path first. The Free path must still be tested with a second account before launch.

Implementation: `user.linkedin_tier` plus `user.inmail_credits_remaining` → a **capabilities object** that every agent receives in its context. The budget manager (A7) and prioritizer (A4) read it directly.

---

## 8. Technical architecture (SaaS)

```
┌──────────────── Browser extension (MV3) ────────────────┐     ┌──────────── Web app (Next.js) ────────────┐
│ Side panel on linkedin.com pages the user opens         │     │ Onboarding · Daily Brief · Approval Queue │
│ "Analyze this page" (user-triggered) → score / drafts   │     │ Pipeline board · KB editor · Analytics    │
│ Copy / insert-draft buttons — user presses Send         │     │ Settings · Billing                        │
└──────────────────────────┬──────────────────────────────┘     └──────────────────┬────────────────────────┘
                           │  HTTPS + user JWT                                     │
                           ▼                                                       ▼
                ┌─────────────────────────── API layer (Next.js route handlers / tRPC) ───────────────────────────┐
                │ Auth (Supabase) · Rate limiting · Plan entitlements · Usage metering                             │
                └───────────────┬───────────────────────────────┬──────────────────────────────┬───────────────────┘
                                ▼                               ▼                              ▼
                 Agent runtime (Claude Agent SDK)     Job queue (Inngest / Trigger.dev)   Inbound email (Postmark/
                 Orchestrator + subagents A1–A13      Scheduled: ATS polling, daily       SendGrid inbound parse)
                 Tools = typed internal functions     brief, follow-up SLAs, re-audits    → job-alert parser
                                ▼
                 Postgres + pgvector (Supabase) with Row-Level Security per user_id · Object storage (resumes, exports)
```

| Concern | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) on Vercel, Tailwind + shadcn/ui | Shared UI package with the extension |
| Auth | Supabase Auth: email, Google, **LinkedIn OIDC** | Extension authenticates via `chrome.identity.launchWebAuthFlow`, and the backend issues a short-lived JWT |
| Data isolation | Postgres **RLS on every table by `user_id`** | Encrypt resumes, KB and message drafts at rest |
| LLM | Claude: Opus 5.5 for writing and strategy; Sonnet 5 / Haiku 4.5 for extraction, scoring and parsing | **Prompt caching** on each user's KB + persona block to cut cost; per-user token metering tied to plan limits |
| Agents | Claude Agent SDK. Each agent is a subagent with a narrow tool set; the orchestrator is the only one that plans | Tools are internal functions (DB reads/writes, research, doc rendering), **never** a LinkedIn-driving browser |
| Background jobs | Inngest or Trigger.dev | Durable workflows: ingest → dedupe → enrich → score → shortlist |
| Job alerts | **Forwarding address + inbound parse** instead of Gmail OAuth | Reading Gmail needs a Google *restricted scope*, which requires a paid annual security assessment (CASA) and weeks of review. Forwarding avoids that; add optional Gmail OAuth later |
| Other job sources | Greenhouse / Lever / Ashby / Workable public board APIs | Polled for each user's target companies; shared cache across users |
| Documents | DOCX (docx-js) + PDF render from ATS-safe templates | Resume versions stored per application |
| Posting | LinkedIn **Posts API** (`w_member_social`) with the user's OAuth consent | The only write action to LinkedIn, and only after approval |
| Billing | Stripe (subscriptions, trials, usage caps) | |
| Observability | Sentry, PostHog (product analytics), LLM tracing (Langfuse or similar) | |
| Evals | Golden datasets for fit scoring, tailoring truthfulness, message quality, and job-alert email parsing | Run in CI on every prompt change |

### Core data model (all tables carry `user_id` + RLS)
`User · Subscription · SearchProfile(personas, mode, tier, capabilities) · KBFact · Story · Company(shared) · Job(shared) · UserJob(score, status) · Application · ResumeVersion · Contact · Interaction · Post · Interview · Offer · Task · UsageEvent`

Shared tables (Company, Job) are deduplicated across users. Per-user state lives in join tables, so one crawl serves everyone.

---

## 9. Browser extension design

**Principle:** it's a *copilot for the page the user is looking at*, not a bot. Every read is triggered by the user and scoped to the current tab. No background crawling and no auto-clicks.

| Page the user opens | Side panel shows | User action |
|---|---|---|
| **Job post** (`/jobs/view/…`) | Fit score, gaps, red flags, warm paths into the company, "Save to pipeline", tailored-resume button, pre-filled screening answers | Click Apply themselves; copy answers from the panel |
| **Easy Apply modal** | Answer sheet for this job's questions, drawn from the answer bank | User fills and submits |
| **Person profile** (`/in/…`) | Who they are relative to target jobs, shared context (school, company, mutuals), suggested approach, invite note / message draft | Copy or insert the draft; user sends |
| **Company page** | Research brief, open roles vs fit, people to contact, growth signals | Save company to targets |
| **People tab / 2nd-degree search / job "who you know" module** | **Referral Scout**: ranked referrers + mutual bridges, best path, intro/referral drafts | User sends asks |
| **Messaging thread** | Reply suggestions, context from the CRM, follow-up reminder setter | User sends |
| **Feed / post** | Comment suggestions for posts by target people | User posts the comment |
| **Own profile** | Section-by-section audit and rewrite suggestions | User edits |

Technical notes:
- **Chrome MV3** with the Side Panel API; later Edge (same build) and Firefox.
- **Minimal permissions:** `sidePanel`, `storage`, `activeTab`, and host permission for `linkedin.com` only.
- **Extraction:** read the visible page text only on a user click, with resilient selectors plus an LLM fallback that parses `innerText`, because LinkedIn's DOM changes often.
- "Insert draft" puts text into the compose box. **The extension never clicks Send, Connect, Apply or Post.**
- **Third-party data minimization:** don't bulk-store other people's profiles. Keep only the contacts the user saves to the CRM, with a retention policy. This matters for GDPR/CCPA/DPDP and for LinkedIn's anti-scraping enforcement, which has already shut down data-scraping companies.
- Pass Chrome Web Store review: a single purpose, a clear privacy policy, and a permissions justification.

---

## 10. Compliance and trust (required for a multi-user product)
- ToS-safe by design: human-in-the-loop, rate budgets, no automation of LinkedIn actions. Say this in marketing, because it sets us apart from bot tools that get users banned.
- **LinkedIn app review** for Sign In with LinkedIn + Share on LinkedIn: self-serve products, but branding guidelines apply.
- Privacy policy, DPA, data export and account deletion (GDPR/CCPA/DPDP), a subprocessor list (Anthropic, Supabase, Vercel, Stripe, Postmark).
- No training on user data; clear LLM data-handling disclosure.
- Truthfulness guardrail (A12) as a product promise: "We never fabricate your experience."

---

## 11. Success metrics
- **User outcomes:** interviews per week, time to first interview, time to offer, offer rate.
- **Funnel:** response rate by channel (referral vs cold vs Easy Apply), invite acceptance above 40%, reply rate above 20%.
- **Product:** activation (audit completed plus extension installed within 24h), weekly active users, daily-brief open rate, approvals per user-week, retention until hire.
- **Business:** trial→paid conversion, LLM cost per active user versus ARPU, churn (note that success = churn, so plan for referrals and alumni plans).
- **Safety:** zero account restrictions reported, zero fabricated claims in audits.

---

## 12. Build roadmap

| Phase | Scope |
|---|---|
| **M0 Foundation (1–2 wks)** | Monorepo (Next.js web, extension, shared packages), Supabase schema + RLS, auth (email/Google/LinkedIn OIDC), Stripe skeleton, agent runtime scaffolding, eval harness |
| **M1 MVP (3–4 wks)** | Onboarding questionnaire + imports, A1 KB, A2 Profile audit and rewrite, A3 (paste + forwarding-address alerts), A4 scoring, A5 resume tailoring + truthfulness check, A9 pipeline board, **extension v1 on job pages** (score + save + answers) |
| **M2 Networking (3 wks)** | A7 warm-path finder (from the data export), outreach drafts, budget manager (tier-aware), Approval Queue, daily brief email, **extension on profile and messaging pages** |
| **M3 Brand + Interviews (3 wks)** | A8 content + Posts API publishing, comment copilot in the extension, A6 research briefs, A10 interview prep + mock interviews |
| **M4 Scale (ongoing)** | A11 offers, A13 analytics + A/B tests, ATS board polling at scale, Edge/Firefox, optional Gmail OAuth (after CASA), team/coach accounts |

---

## 13. Decisions (round 2, locked)

| Decision | Choice | Implication |
|---|---|---|
| Pricing | **Free** | LLM cost is the main risk: design for a low cost per active user from day one (below) |
| Market | **Global** | Multi-currency salary data, i18n-ready UI (English first), GDPR + CCPA + DPDP + other regional privacy law, data hosted in the EU or US with a disclosure |
| Domains | **Generic** (all roles) | Domain packs are generated on the fly from each user's target job descriptions rather than hand-curated |
| Name | **Offerwing** (picked 2026-09-24; trademark search pending) | |

### 13.1 Keeping a free product sustainable
- **Model routing:** Haiku 4.5 for parsing, extraction and scoring (most calls); Sonnet 5 for drafts; Opus only for the profile rewrite and weekly strategy.
- **Prompt caching** of each user's KB + persona block (large savings on repeat calls).
- **Shared caches:** jobs, companies and company briefs are computed once and reused by every user.
- **Fair-use quotas** per user per day (e.g. tailored resumes, drafts, mock interviews), shown clearly in the UI.
- **Batch API** for non-urgent overnight work (job scoring, re-audits) at about half the cost.
- **Cost dashboard:** track $/active user/week and alert on outliers.
- Keep a **future paid tier** open (higher quotas, voice mock interviews, priority), but launch free.

### 13.2 Naming rules
- **Must not** contain "Linked", "LinkedIn" or "In" as a brand element. LinkedIn's brand guidelines forbid it, and it risks a takedown from the Chrome Web Store or the LinkedIn developer program.
- Short, easy to say worldwide, has an available domain, and doesn't lock us to one platform (we may add Indeed, Wellfound and others later).

### 13.3 Name shortlist (domains checked via DNS/whois on 2026-09-24 — confirm at a registrar before buying)

| Name | Domain | Why it works |
|---|---|---|
| **Offerwing** (recommended) | offerwing.ai open; offerwing.com parked for sale (Afternic) | "A wingman that gets you to the offer." Says the outcome, friendly but professional, memorable |
| **Hirepath** | hirepath.ai open (.com taken) | Clear, corporate-safe, reads well globally |
| **Offerbound** | offerbound.ai open | Aspirational ("bound for an offer"), a strong tagline hook |
| **Jobwingman** | jobwingman.ai open (.com taken) | Very catchy and descriptive; slightly less premium |
| **Kareero** | kareero.ai open | Brandable, and "career" reads across languages; needs more marketing to build meaning |

Next step once a name is picked: a trademark search (USPTO, EUIPO, WIPO Global Brand Database), then register the domain + Chrome Web Store listing + social handles.

---

## 14. Model strategy (Anthropic Claude, routed by task)

Prices are per 1M tokens (input / output), Anthropic API list prices; re-check before launch.

| Tier | Model | Price | Used for |
|---|---|---|---|
| Bulk | `claude-haiku-4-5` | $1 / $5 | Job-alert email parsing, JD extraction, dedupe, fit scoring, red-flag checks, classification |
| Workhorse | `claude-sonnet-5` | $2 / $10 | Resume tailoring, cover letters, outreach and comment drafts, company briefs, mock interviews |
| Premium | `claude-opus-5` | $5 / $25 | One-time deep profile rewrite, weekly strategy review, negotiation plans (low volume) |

Cost levers: prompt caching of each user's KB/persona prefix (cache reads cost a small fraction of normal input), Batch API (50% off) for overnight scoring and re-audits, shared job/company caches, per-user daily quotas.

Rough estimate for a heavily active user: about $0.25–0.35/day before caching and batching, about $3–6/month after. Validate with real usage logs in the beta.

Keep a thin **model gateway** (one internal `llm.call(task, …)` function mapping task → model) so models can be swapped or A/B-tested per task without touching agent code.

---

## 15. Bring Your Own Key (BYOK): decided, and the user chooses the mode

The user supplies their own AI provider key (OpenAI, Anthropic or Gemini) so the product stays free without Offerwing paying for AI usage.

### Two key-storage modes (the user chooses)

| | **Local mode** (max privacy) | **Cloud mode** (full features) |
|---|---|---|
| Where the key lives | Browser extension's `chrome.storage.local` (isolated from web pages, unlike website `localStorage`) | Our server, envelope-encrypted (KMS / Supabase Vault), write-only: the UI only ever shows `sk-…abcd` |
| Where AI calls run | Directly from the extension / browser to the provider. The key never reaches Offerwing servers | Server workers decrypt the key only in memory at call time; never logged or returned |
| Background agents (overnight scoring, daily brief, alert-email processing, follow-up reminders) | Only while the browser is open (extension alarms) | Yes, 24/7 |
| Risk | XSS or a malicious dependency in the page could read it → strict CSP, no third-party scripts, pinned dependencies | A server breach → encryption, KMS, access audit, rotation |

- The website uses the key **through the extension** (`externally_connectable` messaging), so it is never kept in website `localStorage`.
- **Starter credits on Offerwing's key** for onboarding (profile audit + first job shortlist), so users without an API key still get value before being asked for one.
- **Key hygiene guide** shown in onboarding: create a dedicated project key, set a monthly spend limit in the provider dashboard, and revoke it anytime.
- **Multi-provider gateway:** the §14 routing layer maps each task to a model per provider (e.g. OpenAI cheap/mid/top tiers, or Claude Haiku/Sonnet/Opus). Evals run per provider so quality is known.
- Show usage and estimated spend per agent in Settings, so users trust the product with their key.

### Choice UX (onboarding step "Power your AI" + Settings → AI & Keys)

| Option | Card copy | Unlocks |
|---|---|---|
| **Starter** (default) | "Try Offerwing free, no key needed" | Profile audit, first job shortlist, limited daily drafts on Offerwing's credits |
| **Private: key stays in your browser** | "Most private. Your key never leaves this device. AI features work while your browser is open." | All interactive features; background agents only while the browser is open |
| **Always-on: encrypted key in the cloud** | "Agents work 24/7: overnight job scoring, morning brief, reminders. Key encrypted, never shown again." | Everything |

- Then pick a **provider** (OpenAI / Anthropic / Gemini) and paste the key. It's validated with a cheap test call and the user sees which models will be used.
- A **comparison table** under the cards shows which features each mode enables, so the trade-off is explicit.
- **Switch anytime.** Cloud → Private **deletes the server copy immediately** (and shows a confirmation). Private → Cloud re-encrypts and uploads the key after explicit consent.
- **Per-device awareness.** Private mode keys are per browser, so on a new device the app prompts "Add your key on this device" or suggests Cloud mode.
- **Feature gating in the UI.** Background features show a lock with "Needs Always-on mode or an open browser", never a silent failure.
- **Remove key** (one click) wipes it from wherever it is stored and revokes all queued jobs that would use it.

---

## 16. User dashboard: "everything about my job search in one place"

### How the user connects their LinkedIn (no passwords)
- Sign up / log in with **Sign In with LinkedIn (OIDC)**. This links the account (name, photo, email, LinkedIn member ID) without us ever seeing the LinkedIn password.
- **We never ask for or store LinkedIn passwords or session cookies.** That would violate LinkedIn's ToS, get users banned, and make Offerwing a credential-theft target. LinkedIn's API also doesn't give regular apps profile views, search appearances or applications, so the data comes from the sources below.

### Data sources feeding the dashboard
| Source | What it provides | Freshness |
|---|---|---|
| **Extension "Sync"** (on the user's *own* LinkedIn pages when they visit them; one click, or auto-capture with opt-in consent) | Profile views + who viewed, search appearances + keywords, post impressions, followers, Saved / Applied jobs (My Jobs), invitations sent/received, profile content for the audit | Whenever the user visits; a nudge if older than 7 days |
| **LinkedIn data export** (monthly reminder) | Connections, messages, applications, saved jobs, invitations, full profile | Monthly |
| **Forwarded LinkedIn emails** (the alert address from §6) | Job alerts, "your application was viewed", InMail/message notifications, weekly search-appearance emails | Real time |
| **Offerwing's own records** | Pipeline, tailored resumes, outreach and referral status, interviews, offers, AI usage | Real time |
| **Posts API** (for posts published through Offerwing) | Post IDs and links; analytics via extension sync | On publish |

Every widget shows its **source and "last synced" time**, so numbers are never mysterious.

### Dashboard pages
1. **Home / Today**: daily brief, today's tasks (approve drafts, send follow-ups, apply), weekly goal progress, streak.
2. **Profile health**: audit score 0–100 over time, section-by-section fixes, keyword coverage vs target roles, headline A/B results.
3. **Visibility**: profile views, search appearances and top keywords (trend charts), who viewed (recruiters highlighted, with one-click "reach out"), follower growth.
4. **Jobs pipeline**: kanban (Discovered → Applied → Screen → Interview → Offer), fit scores, days since last action, ghosted detection.
5. **Applications**: every application with its resume version, cover letter, answers, channel (referral / Easy Apply / company site) and outcome.
6. **Referrals & network**: Referral Scout maps per company, asks in flight, invite acceptance rate, relationship-strength heatmap.
7. **Outreach inbox**: drafts awaiting approval, sent messages, replies, follow-ups due.
8. **Content**: calendar, drafts, published posts with impressions and engagement, and which posts led to profile views or conversations.
9. **Interviews & offers**: calendar, prep packs, mock-interview scores, offer comparison.
10. **Insights**: funnel conversion by channel, what's working and what's not, weekly AI coach review.
11. **Settings**: search profile, AI & keys (mode, provider, spend), integrations (extension, email forwarding, LinkedIn link), privacy (export or delete all data).

---

## 17. Build status (September 2026)

Every agent in the plan, the B2B additions below, and both surfaces (web app and Chrome extension) are built. All are tested up to the AI call; none has run against a real model yet.

| Plan item | Built as |
|---|---|
| A0 Career Coach | Weekly plan on Today (`lib/agents/coach.ts`) |
| A1 Knowledge base | Cached document text plus STAR story bank (`stories`) |
| A2 Profile Optimizer | Profile health audit |
| A3 Job Discovery | Inbox from forwarded alert emails and Greenhouse / Lever / Ashby boards, cron every 6 hours |
| A4 Job Match | Fit scoring (server, or in the extension for Private mode) |
| A5 Application Tailoring | Application kits with truthfulness check and `.docx` resume |
| A6 Company Research | Company brief inside interview prep packs (web search on Anthropic) |
| A7 Networking & Outreach | Outreach page: follow-ups, referral asks, connection notes, weekly invite budget |
| A8 Content & Brand | Content page: plan, drafts, comment ideas, share-to-LinkedIn |
| A9 Tracker | Pipeline, contacts, due dates in the user's time zone |
| A10 Interview Prep | Prep packs and practice feedback |
| A11 Offer & Negotiation | Offer comparison and negotiation plans |
| A12 Guardrails | Human-sends-everything, Starter limits, truthfulness check, retention jobs, RLS |
| A13 Analytics | Insights page (funnel and channels) |
| A14 Referral Scout | LinkedIn export import, ranking, drafts |
| A15 Application Autofill | Extension fills Greenhouse / Lever / Ashby / Workday / SmartRecruiters / Workable forms (other sites after a per-site permission) from application details, the kit and the resume; drafts open answers; the user submits. Never touches demographic or consent questions. |
| A16 Referral Packet | Public `/r/<token>` page per job and referrer: evidence-checked fit points, referral-form blurb, tailored resume, view counts, 30-day expiry, Offerwing sign-up link (growth loop) |

### 17.1 Business model (added September 2026)

Job seekers stay free. Revenue comes from teams:

- **B2B outplacement** (primary): an employer creates an outplacement program at `/org`, invites leavers with seat-limited links, sponsors their AI with its own key (members' runs skip Starter limits), brands it, and sees program totals (5+ members) plus individual progress for people who opt in. Seats and sponsorship dates are set by Offerwing per contract.
- **Opt-in talent marketplace** (second): candidates publish an anonymous, fact-checked profile ("Get discovered"); recruiting teams that Offerwing has verified search it and request intros; the candidate accepts (sharing contact details, role added to their pipeline) or declines. Candidates hide from named companies, their current employer by default. Search access is what a recruiting team would pay for.

Remaining before launch: live AI runs and prompt tuning, real-LinkedIn testing of the extension, OAuth / email / inbound-email / deployment setup, legal review, Chrome Web Store, observability and evals.
