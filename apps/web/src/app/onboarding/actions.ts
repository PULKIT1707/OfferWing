"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { verifyProviderKey } from "@/lib/ai-keys";
import {
  careerSchema,
  linkedinSchema,
  preferencesSchema,
  PROVIDERS,
  STEPS,
  type Provider,
  type StepId,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; fieldErrors?: Record<string, string> };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
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

async function saveSearchProfile(step: StepId, schema: z.ZodType<Record<string, unknown>>, input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("search_profiles")
    .upsert({ user_id: userId, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save your answers. Please try again." };
  revalidatePath("/dashboard", "layout");
  return advance(step);
}

export async function saveCareer(input: unknown) {
  return saveSearchProfile("career", careerSchema, input);
}

export async function savePreferences(input: unknown) {
  return saveSearchProfile("preferences", preferencesSchema, input);
}

export async function saveLinkedin(input: unknown) {
  return saveSearchProfile("linkedin", linkedinSchema, input);
}

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
