import { z } from "zod";

export const STEPS = [
  { id: "career", title: "Your goals", hint: "Roles and search mode" },
  { id: "preferences", title: "Preferences", hint: "Location, pay and time" },
  { id: "linkedin", title: "LinkedIn", hint: "Plan and target companies" },
  { id: "documents", title: "Your experience", hint: "Resume and LinkedIn data" },
  { id: "ai", title: "Power your AI", hint: "Choose how agents run" },
  { id: "connect", title: "Connect", hint: "Job alerts and extension" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

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
  seniority: z.enum(SENIORITY.map(([v]) => v) as [string, ...string[]]),
  industries: list,
  search_mode: z.enum(["open", "stealth"]),
  urgency: z.enum(["active", "exploring"]),
});

export const preferencesSchema = z
  .object({
    locations: list.min(1, "Add at least one location (or \"Anywhere\")"),
    work_modes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1, "Pick at least one work mode"),
    open_to_relocate: z.boolean(),
    needs_sponsorship: z.boolean(),
    salary_min: z.number().int().min(0).nullable(),
    salary_target: z.number().int().min(0).nullable(),
    salary_currency: z.enum(CURRENCIES),
    notice_period: z.string().trim().max(40).nullable(),
    daily_minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
  })
  .refine((v) => v.salary_min == null || v.salary_target == null || v.salary_target >= v.salary_min, {
    message: "Target salary should be at least your minimum",
    path: ["salary_target"],
  });

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
  seniority: "mid",
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
