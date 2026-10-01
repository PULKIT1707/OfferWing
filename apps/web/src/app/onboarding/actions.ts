"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { verifyProviderKey } from "@/lib/ai-keys";
import { buildPrefillPrompt, normalizePrefill, PROFILE_PREFILL_SYSTEM, profilePrefillSchema, type ProfilePrefill } from "@/lib/agents/profile-prefill";
import { APPLICATION_PROFILE_COLUMNS } from "@/lib/application-profile";
import { loadCareerText } from "@/lib/documents";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";
import {
  basicsSchema,
  careerSchema,
  linkedinSchema,
  preferencesSchema,
  PROVIDERS,
  STEPS,
  type Provider,
  type SearchProfile,
  type StepId,
} from "@/lib/onboarding";
import { extractResumeFacts } from "@/lib/resume-facts";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null };
}

function nextStep(step: StepId): StepId | "done" {
  const i = STEPS.findIndex((s) => s.id === step);
  return i === STEPS.length - 1 ? "done" : STEPS[i + 1].id;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// Moves the wizard forward. No-op once onboarding is done (the same steps are reused in Settings).
async function advance(step: StepId) {
  const { supabase, userId } = await requireUser();
  const next = nextStep(step);
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_step: next,
      updated_at: new Date().toISOString(),
      ...(next === "done" ? { onboarding_completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", userId)
    .neq("onboarding_step", "done");
  return error ? { error: "Couldn't save your progress. Please try again." } : {};
}

async function saveSearchProfile(step: StepId | null, schema: z.ZodType<Record<string, unknown>>, input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("search_profiles")
    .upsert({ user_id: userId, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save your answers. Please try again." };
  revalidatePath("/dashboard", "layout");
  return step ? advance(step) : {};
}

// The onboarding "Check the basics" screen (goals and preferences together).
export async function saveBasics(input: unknown) {
  return saveSearchProfile("career", basicsSchema, input);
}

// Settings forms (onboarding is already done there).
export async function saveCareer(input: unknown) {
  return saveSearchProfile(null, careerSchema, input);
}

export async function savePreferences(input: unknown) {
  return saveSearchProfile(null, preferencesSchema, input);
}

export async function saveLinkedin(input: unknown) {
  return saveSearchProfile(null, linkedinSchema, input);
}

export type PrefillResult = ActionResult & {
  // Human-readable list of what was filled in, e.g. ["target roles", "phone"].
  filled?: string[];
  // Why AI suggestions (roles, seniority, industries, location) weren't available, if they weren't.
  aiNote?: string;
  profile?: Partial<SearchProfile>;
};

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

// Reads the uploaded resume / LinkedIn PDF and fills in whatever the user hasn't set yet:
// contact details and links without AI, and roles, seniority, industries and location with AI
// when a key is available. Never overwrites something the user already entered.
export async function prefillFromDocuments(): Promise<PrefillResult> {
  const { supabase, userId, email } = await requireUser();
  let careerText: string | null = null;
  try {
    careerText = await loadCareerText(supabase);
  } catch (err) {
    if (!(err instanceof UserFacingError)) throw err;
    return { ...(await advance("documents")), aiNote: err.message };
  }
  if (!careerText) return advance("documents");

  const facts = extractResumeFacts(careerText, new Date());
  let ai: ProfilePrefill | null = null;
  let aiNote: string | undefined;
  const credential = await credentialForAgent(supabase, userId, "profile_prefill");
  // Without AI we still fill contact details; say plainly what's left to type.
  if ("error" in credential) aiNote = "Target roles, seniority and location need AI, which isn't available right now. Add them below; it takes a minute.";
  else {
    try {
      const result = await generateStructured({ credential, tier: "fast", system: PROFILE_PREFILL_SYSTEM, prompt: buildPrefillPrompt(careerText), schema: profilePrefillSchema, schemaName: "profile_prefill" });
      await recordAgentRun(supabase, userId, "profile_prefill", credential, result.model);
      ai = normalizePrefill(result.data);
    } catch (err) {
      if (!(err instanceof UserFacingError)) console.error("profile prefill failed", userId, err);
      aiNote = "We couldn't read your roles and location automatically this time. Fill them in below.";
    }
  }

  const [{ data: search }, { data: app }, { data: profile }] = await Promise.all([
    supabase.from("search_profiles").select("target_roles, seniority, industries, locations").eq("user_id", userId).maybeSingle(),
    supabase.from("application_profiles").select(APPLICATION_PROFILE_COLUMNS).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
  ]);

  const filled: string[] = [];
  const searchPatch: Partial<SearchProfile> = {};
  const place = [ai?.city, ai?.country].filter(Boolean).join(", ");
  const suggest = <K extends keyof SearchProfile>(key: K, value: SearchProfile[K] | undefined, label: string) => {
    if (!isEmpty(value) && isEmpty(search?.[key as keyof typeof search])) {
      searchPatch[key] = value as SearchProfile[K];
      filled.push(label);
    }
  };
  suggest("target_roles", ai?.target_roles, "target roles");
  suggest("seniority", ai?.seniority, "seniority");
  suggest("industries", ai?.industries, "industries");
  suggest("locations", place ? [place] : undefined, "location");
  if (Object.keys(searchPatch).length) {
    await supabase.from("search_profiles").upsert({ user_id: userId, ...searchPatch, updated_at: new Date().toISOString() });
  }

  const [nameFirst, ...nameRest] = (profile?.full_name ?? "").trim().split(/\s+/);
  const appSuggestions: Record<string, [unknown, string]> = {
    first_name: [ai?.first_name || nameFirst || null, "name"],
    last_name: [ai?.last_name || nameRest.join(" ") || null, "name"],
    email: [facts.email ?? email, "email"],
    phone: [facts.phone, "phone"],
    linkedin_url: [facts.linkedinUrl, "LinkedIn link"],
    github_url: [facts.githubUrl, "GitHub link"],
    website_url: [facts.websiteUrl, "website"],
    current_title: [ai?.current_title || null, "current role"],
    current_company: [ai?.current_company || null, "current role"],
    city: [ai?.city || null, "location"],
    country: [ai?.country || null, "location"],
    years_experience: [facts.yearsExperience, "years of experience"],
    how_heard: ["LinkedIn", ""],
  };
  const appPatch: Record<string, unknown> = {};
  for (const [key, [value, label]] of Object.entries(appSuggestions)) {
    if (isEmpty(value) || !isEmpty((app as Record<string, unknown> | null)?.[key])) continue;
    appPatch[key] = value;
    if (label && !filled.includes(label)) filled.push(label);
  }
  if (Object.keys(appPatch).length) {
    await supabase.from("application_profiles").upsert({ user_id: userId, ...(app ?? {}), ...appPatch, updated_at: new Date().toISOString() });
  }

  revalidatePath("/dashboard", "layout");
  const advanced = await advance("documents");
  return { ...advanced, filled, aiNote, profile: searchPatch };
}

// Kept for the "Skip for now" path when no documents were uploaded.
export async function completeDocuments(): Promise<ActionResult> {
  return advance("documents");
}

const isProvider = (p: unknown): p is Provider => PROVIDERS.some(([id]) => id === p);

export async function chooseAiMode(mode: "starter" | "private", provider: Provider | null): Promise<ActionResult> {
  if (mode === "private" && !isProvider(provider)) return { error: "Pick the AI provider for your key." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_ai_mode", { p_mode: mode, p_provider: mode === "starter" ? null : provider });
  if (error) return { error: "Couldn't save your AI settings. Please try again." };
  revalidatePath("/dashboard", "layout");
  return advance("ai");
}

export async function saveCloudKey(provider: Provider, key: string): Promise<ActionResult> {
  if (!isProvider(provider)) return { error: "Pick the AI provider for your key." };
  const trimmed = key.trim();
  if (trimmed.length < 20) return { fieldErrors: { key: "That doesn't look like a complete API key." } };

  const check = await verifyProviderKey(provider, trimmed);
  if (!check.ok) return { fieldErrors: { key: check.error } };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_cloud_ai_key", { p_provider: provider, p_key: trimmed });
  if (error) return { error: "Couldn't store your key securely. Please try again." };
  revalidatePath("/dashboard", "layout");
  return advance("ai");
}

export async function finishOnboarding(): Promise<ActionResult> {
  const result = await advance("connect");
  if (result.error) return result;
  redirect("/dashboard");
}

export async function goToStep(step: StepId): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ onboarding_step: step }).eq("id", userId).neq("onboarding_step", "done");
}
