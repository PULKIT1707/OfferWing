import { z } from "zod";

// Onboarding asks for as little as possible: the resume first, then one prefilled "basics" screen.
// Plan, target companies and writing samples live in Settings (the "linkedin" form).
export const STEPS = [
  { id: "documents", title: "Your resume", hint: "We read it so you type less" },
  { id: "career", title: "Check the basics", hint: "Prefilled from your resume" },
  { id: "ai", title: "Power your AI", hint: "Choose how agents run" },
  { id: "connect", title: "Connect", hint: "Job alerts and extension" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

// Steps from the older, longer wizard that may still be saved on a profile.
export const LEGACY_STEPS: Record<string, StepId> = { preferences: "career", linkedin: "career" };

export const SENIORITY = [
  ["intern", "Intern"],
  ["entry", "Entry level"],
  ["mid", "Mid level"],
  ["senior", "Senior"],
  ["lead", "Lead / Staff"],
  ["manager", "Manager"],
  ["director", "Director"],
  ["executive", "Executive"],
] as const;

export const WORK_MODES = [
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "On-site"],
] as const;

export const LINKEDIN_TIERS = [
  ["free", "Free", "No InMail, limited invite notes"],
  ["premium_career", "Premium Career", "About 5 InMails a month"],
  ["premium_business", "Premium Business", "About 15 InMails, company insights"],
  ["sales_navigator", "Sales Navigator", "About 50 InMails, advanced search"],
  ["recruiter_lite", "Recruiter Lite", "Recruiter search tools"],
] as const;

export const DAILY_MINUTES = [15, 30, 60, 90] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "AED", "JPY"] as const;

export const PROVIDERS = [
  ["openai", "OpenAI", "sk-…", "https://platform.openai.com/api-keys"],
  ["anthropic", "Anthropic", "sk-ant-…", "https://console.anthropic.com/settings/keys"],
  ["gemini", "Google Gemini", "AIza…", "https://aistudio.google.com/apikey"],
] as const;

export type Provider = (typeof PROVIDERS)[number][0];

const list = z.array(z.string().trim().min(1).max(80)).max(20);

export const careerSchema = z.object({
  target_roles: list.min(1, "Add at least one target role").max(3, "Pick up to 3 roles"),
  seniority: z.array(z.enum(SENIORITY.map(([v]) => v) as [string, ...string[]])).min(1, "Pick at least one level").max(4, "Pick up to 4 levels"),
  industries: list,
  search_mode: z.enum(["open", "stealth"]),
  urgency: z.enum(["active", "exploring"]),
});

const preferencesFields = z.object({
  locations: list.min(1, "Add at least one location (or \"Anywhere\")"),
  work_modes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1, "Pick at least one work mode"),
  open_to_relocate: z.boolean(),
  needs_sponsorship: z.boolean(),
  salary_min: z.number().int().min(0).nullable(),
  salary_target: z.number().int().min(0).nullable(),
  salary_currency: z.enum(CURRENCIES),
  notice_period: z.string().trim().max(40).nullable(),
  daily_minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
});
const salaryOrder = (v: { salary_min: number | null; salary_target: number | null }) => v.salary_min == null || v.salary_target == null || v.salary_target >= v.salary_min;
const salaryOrderError = { message: "Target salary should be at least your minimum", path: ["salary_target"] };

export const preferencesSchema = preferencesFields.refine(salaryOrder, salaryOrderError);

// The single onboarding screen: goals and preferences together.
export const basicsSchema = careerSchema.extend(preferencesFields.shape).refine(salaryOrder, salaryOrderError);

export const linkedinSchema = z.object({
  linkedin_tier: z.enum(LINKEDIN_TIERS.map(([v]) => v) as [string, ...string[]]),
  inmail_credits: z.number().int().min(0).max(500).nullable(),
  dream_companies: list,
  excluded_companies: list,
  voice_samples: z.string().trim().max(6000).nullable(),
});

export type CareerInput = z.infer<typeof careerSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type LinkedinInput = z.infer<typeof linkedinSchema>;

export type SearchProfile = CareerInput & PreferencesInput & LinkedinInput;

export type AiSettings = { mode: "starter" | "private" | "cloud"; provider: Provider | null; key_last4: string | null };

export type CareerDocument = { id: string; kind: "resume" | "linkedin_pdf" | "linkedin_export"; file_name: string; size_bytes: number };

export const DEFAULT_PROFILE: SearchProfile = {
  target_roles: [],
  seniority: [],
  industries: [],
  search_mode: "open",
  urgency: "active",
  locations: [],
  work_modes: [],
  open_to_relocate: false,
  needs_sponsorship: false,
  salary_min: null,
  salary_target: null,
  salary_currency: "USD",
  notice_period: null,
  daily_minutes: 60,
  linkedin_tier: "free",
  inmail_credits: null,
  dream_companies: [],
  excluded_companies: [],
  voice_samples: null,
};

// Fills unset columns so forms always get a complete profile.
export function withDefaults(row: Record<string, unknown> | null | undefined): SearchProfile {
  return { ...DEFAULT_PROFILE, ...Object.fromEntries(Object.entries(row ?? {}).filter(([, v]) => v !== null)) } as SearchProfile;
}

// "Senior / Lead / Staff" for prompts and labels; levels are shown in ladder order.
export function seniorityLabel(levels: readonly string[] | null | undefined, fallback = "unspecified"): string {
  const labels = SENIORITY.filter(([v]) => levels?.includes(v)).map(([, l]) => l);
  return labels.length ? labels.join(" / ") : fallback;
}
