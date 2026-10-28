# Offerwing user guide

Offerwing helps you run your job search: it checks your LinkedIn profile, finds and scores jobs, writes tailored applications, and shows who in your network can refer you. Everything it writes is a draft. You review it and send it yourself; Offerwing never logs into LinkedIn or sends anything for you.

---

## 1. Create your account

1. Go to **offerwing.app** and click **Sign up**.
2. Choose **Continue with LinkedIn**, **Continue with Google**, or enter your name, email and a password (8+ characters).
3. If you used email, open the confirmation email and click the link.

You land on a short setup wizard (about 5 minutes).

## 2. Set up (4 steps)

### Step 1: Your resume
Upload what you have. You can add or remove files later in **Settings → Documents**.

| File | Why | How to get it |
|---|---|---|
| **Resume** (PDF or DOCX) | The most useful file. Everything Offerwing writes is based on it. | Your own file. |
| **LinkedIn profile PDF** | Used for the profile audit. | On LinkedIn: open your profile → **Resources** (or **More**) → **Save to PDF**. |
| **LinkedIn data export** (ZIP) | Shows who you know at each company. | On LinkedIn: **Settings → Data privacy → Get a copy of your data**. LinkedIn emails it within about a day, so you can add it later. |

Click **Continue**. Offerwing reads your resume and fills in what it can (email, phone, LinkedIn and GitHub links, years of experience and, with AI, your target roles and location).

### Step 2: Check the basics
Check what was filled in and complete the rest:
- **Target roles**: up to 3. Type one and press Enter.
- **Seniority**: pick every level you'd consider.
- **Locations**: cities, countries or "Anywhere".
- **Work mode**: remote, hybrid, on-site.
- **Keep my search discreet**: turn on if you're employed and don't want #OpenToWork signals.
- **Need visa sponsorship**: turn on if you do. Offerwing flags jobs that say they don't sponsor.
- **More preferences** (optional): industries, relocation, salary range, notice period, how actively you're looking, and how much time you have each day.

### Step 3: Power your AI
| Option | What it means |
|---|---|
| **Starter** | No key needed. A few free AI runs a day (for example 2 profile audits, 20 job scores and 5 application kits). Resets at 00:00 UTC. |
| **Private** | Use your own AI key, kept only in the Offerwing browser extension. Job scores and form answers run from your browser. |
| **Always-on** | Use your own OpenAI, Anthropic or Gemini key, stored encrypted. No daily limits; you pay your provider directly (usually a few dollars a month). |

Start with Starter; you can switch anytime in **Settings → AI & keys**. If you add a key, create one just for Offerwing and set a monthly spending limit at your provider. After you save it, only the last 4 characters are ever shown.

### Step 4: Connect
- Copy your **personal alert address**. You'll forward LinkedIn job alerts to it (see section 4).
- Optionally install the browser extension (see section 11).

Click **Go to my dashboard**.

## 3. Finish your settings

Open **Settings** from the sidebar. The ones worth doing now:

- **LinkedIn**: your LinkedIn plan and InMail credits, **Dream companies** (Referral Scout starts with these), **Companies to avoid** (add your current employer; jobs there are never scored or suggested), and **Writing samples** (paste 2–3 posts or emails so drafts sound like you).
- **Application details**: name, email, phone, address, links, current role, years of experience and countries you can work in without sponsorship. The extension uses these to fill application forms. Demographic and consent questions are never stored or filled.

## 4. Get jobs into your Inbox

New jobs land in the **Inbox** at the top of **Jobs**. Two ways to feed it (both in **Settings → Job sources**):

**Forward LinkedIn job alerts**
1. In Gmail: **Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address** and paste your alert address.
2. Gmail sends a confirmation. The code appears in Settings → Job sources within a minute; enter it in Gmail.
3. Create a Gmail filter: from `jobalerts-noreply@linkedin.com` → forward to your alert address.
   (Outlook: **Settings → Mail → Rules**, same condition, forward to your alert address.)

**Follow company careers pages**
1. Paste a careers link from Greenhouse, Lever, Ashby, SmartRecruiters, Workable or Recruitee, for example `boards.greenhouse.io/stripe` or `jobs.lever.co/spotify`, and click **Follow**.
2. Matching roles are added right away, then checked again regularly. Click **Check now** anytime.
3. Untick **Only my target roles** on a company to see all its jobs.

**Skip titles containing**: words that keep a job out of your Inbox, such as `intern, contract`.

## 5. Manage your jobs pipeline

Go to **Jobs**.

1. **Inbox**: for each job, click **Save** (or **Save & score**) to move it into your pipeline, or **Dismiss** it.
2. **Add job**: paste a job you found elsewhere. Include the full job description so it can be scored.
3. **Score**: jobs with a description get a fit score automatically. Use **Score N jobs** to score the rest. If a job can't be scored, Offerwing tells you why (no description, a company you avoid, posting closed, daily limit).
4. **Open a job** to see its match: requirements you meet (with evidence from your resume), gaps, conflicts with your preferences (for example "doesn't sponsor visas"), warning signs that the posting isn't real, and how to apply.
5. **Move jobs** between Saved → Applied → Screen → Interviewing → Offer by dragging cards, or by changing **Stage** when you open a job. Add a **Next step** and **Due** date; overdue steps turn red and show on **Today**.
6. Rejected and withdrawn jobs move under **Closed** at the bottom.

## 6. Apply with a tailored kit

Open a job and click **Application kit**. Offerwing writes:
- a resume tailored to the job (download as `.docx`),
- a short cover note,
- a LinkedIn connection note,
- answers to common screening questions.

A **truthfulness check** flags anything it can't trace back to your documents. Fix any `[placeholders]` with facts only you know, then apply.

## 7. Find referrals

Go to **Network**.

1. Click **Import connections** (after uploading your LinkedIn data export).
2. For each target company (your dream companies and saved jobs), Offerwing ranks people you know by how likely they are to help: their role, seniority, how recently you've talked and how long you've been connected.
3. Click **Add** to put someone on your referral list, or **Draft ask** to get a referral message and a follow-up.
4. Copy the message, send it on LinkedIn yourself, then click **I sent it** so Offerwing reminds you to follow up.
5. **Create a referral packet** to give the person a one-page link: why you fit, a blurb for their referral form and your tailored resume. It expires after 30 days, and you can turn it off anytime.

Use **Add person** to add someone who isn't in your export, and **Delete imported connections** to remove the import (people on your referral list stay).

## 8. Stay on top of outreach

Go to **Outreach**:
- **Follow-ups due**: draft a follow-up, mark **They replied** (agreed to refer, referred me, said no) or **Stop** following up. Offerwing suggests at most two follow-ups per person.
- **Ready to ask for a referral**: people on your list you haven't contacted yet.
- **Recruiters and hiring managers to connect with**: draft a connection note (under 300 characters).
- **Connection invites this week**: a weekly budget so you don't trip LinkedIn's limits.

## 9. Prepare for interviews and offers

Go to **Interviews**.

1. **Story bank**: click **Build from my resume** to get STAR stories, or **Add** your own. Tag what each story shows (leadership, collaboration…).
2. Open a job in Screen or Interviewing to build a **prep pack**: pick the round (recruiter screen, hiring manager, technical, behavioral, panel, final), optionally add interviewer notes, and click **Build my prep pack**. You get a company brief, likely questions matched to your stories, a "tell me about yourself" answer and questions to ask.
3. **Practice**: pick a question, type your answer as you'd say it (aim for 150–250 words) and click **Get feedback**.
4. **Offers**: click **Add offer** and enter base, bonus, sign-on, equity, benefits, work mode and deadline. Click **Negotiate** for a plan: your leverage, a concrete ask, an email script and talking points. It never invents competing offers.

## 10. Build visibility (optional)

- **Content**: get a two-week post plan, drafts in your voice with alternative opening lines, and **Open in LinkedIn** to post. Paste someone else's post to get comment ideas. In discreet mode, suggestions stay low-key.
- **Profile**: run the **Profile Optimizer** for a 0–100 score per section, headline options, an About draft, experience rewrites, skills to pin and quick wins.
- **Get discovered**: build an anonymous, fact-checked profile for verified recruiting teams. It never shows your name, employer, school or contact details, and your current employer can't see it. When a team sends an intro request, you choose **Accept** (they get your contact details and the role is added to your pipeline) or decline.

## 11. Use the browser extension

1. Install the Offerwing extension for Chrome.
2. Open **offerwing.app/extension/connect** while logged in and click **Connect extension**.
3. **On LinkedIn**: open a job, profile or company page, click the Offerwing icon, then **Analyze this page**. You see your fit, who you know there, and can save the job to your pipeline.
4. **On an application form** (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Workable, or any site after you allow it once):
   1. Click **Scan this form**.
   2. Check the list of fields it will fill, then click **Fill N fields**. Filled fields are outlined in purple.
   3. For open questions, click **Draft answers with AI**, edit them and fill.
   4. Answer demographic and consent questions yourself; Offerwing leaves them alone.
   5. Review the whole form and **submit it yourself**. Then click **I submitted it: mark as applied**.

The extension reads a page only when you click, and never submits, sends or applies for you.

## 12. Check your progress

- **Today**: what's due, recruiter intro requests, new Inbox jobs, active applications, referral opportunities and a setup checklist. Click **Plan my week** for 4–6 prioritized actions from your Career Coach.
- **Insights**: your funnel (applied → screen → interview → offer), response rate by how you applied, and whether higher fit scores are actually getting more responses.

## 13. For employers and recruiting teams

**Outplacement (supporting people you're letting go)**
1. Go to **offerwing.app/org** and create an **Outplacement program**.
2. Click **New link** to create an invite (choose how many people can use it and for how many days) and share it.
3. People who join get Offerwing, branded with your organization. Add your organization's AI key under **Sponsored AI** to cover their AI usage (set a spend limit at your provider).
4. You see program totals once 5 people have joined, and individual progress only for people who choose to share it.

**Recruiting teams**
1. Create a **Recruiting team** at **offerwing.app/org**. Offerwing verifies the team before it can search.
2. Search anonymous candidate profiles and send intro requests with the role, location, salary range and a message (up to 25 a day).
3. You get the candidate's contact details only if they accept.

## 14. Your data

- **Settings → Privacy & data → Export** downloads everything Offerwing has about you as JSON.
- **Delete account**: type `DELETE` and confirm. Your account, files, jobs, contacts and stored AI key are removed permanently.
- Files are private to your account. Offerwing never asks for your LinkedIn password.
