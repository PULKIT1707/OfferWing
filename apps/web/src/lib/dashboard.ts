export const STAGES = [
  { id: "discovered", label: "Inbox", color: "bg-violet-300" },
  { id: "saved", label: "Saved", color: "bg-zinc-400" },
  { id: "applied", label: "Applied", color: "bg-sky-500" },
  { id: "screen", label: "Screen", color: "bg-amber-500" },
  { id: "interview", label: "Interviewing", color: "bg-wing" },
  { id: "offer", label: "Offer", color: "bg-emerald-500" },
  { id: "rejected", label: "Rejected", color: "bg-rose-400" },
  { id: "withdrawn", label: "Withdrawn", color: "bg-zinc-300" },
  { id: "dismissed", label: "Dismissed", color: "bg-zinc-200" },
] as const;

export type Stage = (typeof STAGES)[number]["id"];
export const OPEN_STAGES: Stage[] = ["saved", "applied", "screen", "interview", "offer"];
export const ACTIVE_STAGES: Stage[] = ["applied", "screen", "interview"];

export const CHANNELS = [
  ["referral", "Referral"],
  ["easy_apply", "Easy Apply"],
  ["company_site", "Company site"],
  ["recruiter", "Recruiter reached out"],
  ["other", "Other"],
] as const;
export type Channel = (typeof CHANNELS)[number][0];

export const RELATIONSHIPS = [
  ["connection", "1st-degree connection"],
  ["mutual", "Reachable via mutual"],
  ["alumni", "Alumni"],
  ["ex_colleague", "Ex-colleague"],
  ["recruiter", "Recruiter"],
  ["hiring_manager", "Hiring manager"],
  ["other", "Other"],
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number][0];

export const REFERRAL_STATUSES = [
  ["none", "Not a referral target"],
  ["to_ask", "To ask"],
  ["asked", "Asked"],
  ["agreed", "Agreed"],
  ["referred", "Referred"],
  ["declined", "Declined"],
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number][0];

export type Job = {
  id: string;
  title: string;
  company: string;
  url: string | null;
  location: string | null;
  stage: Stage;
  source: "manual" | "extension" | "alert" | "ats";
  channel: Channel | null;
  fit_score: number | null;
  description: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_at: string | null;
  applied_at: string | null;
  stage_changed_at: string;
  created_at: string;
};

export type Contact = {
  id: string;
  full_name: string;
  company: string | null;
  title: string | null;
  relationship: Relationship;
  strength: 1 | 2 | 3;
  linkedin_url: string | null;
  referral_status: ReferralStatus;
  job_id: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
};

export const JOB_COLUMNS =
  "id, title, company, url, location, stage, source, channel, fit_score, description, notes, next_action, next_action_at, applied_at, stage_changed_at, created_at";
export const CONTACT_COLUMNS =
  "id, full_name, company, title, relationship, strength, linkedin_url, referral_status, job_id, notes, last_contacted_at, next_follow_up_at";

// "Stripe, Inc." → "stripe", "The Walt Disney Company" → "walt disney". Used to match companies across sources.
const COMPANY_SUFFIXES = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|s\.a|bv|pvt|private|pty|group|holdings|technologies|technology|labs)\b\.?/g;
export function companyKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return key || name.trim().toLowerCase();
}

export const sameCompany = (a: string | null, b: string | null) => !!a && !!b && companyKey(a) === companyKey(b);

// Local calendar date (YYYY-MM-DD) in the browser's time zone. Server code should use userDate()
// from lib/user-time, which uses the time zone saved on the user's profile.
export const today = () => new Date().toLocaleDateString("en-CA");

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function labelOf<T extends string>(options: readonly (readonly [T, string])[], value: T | null) {
  return options.find(([v]) => v === value)?.[1] ?? "";
}
