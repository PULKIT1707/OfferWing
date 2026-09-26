"use server";

import { revalidatePath } from "next/cache";
import { buildCoachPrompt, COACH_SYSTEM, weeklyPlanSchema, type SearchSnapshot } from "@/lib/agents/coach";
import { requireUser } from "@/lib/auth";
import { daysSince, type Job } from "@/lib/dashboard";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";
import { withDefaults } from "@/lib/onboarding";
import { dateInZone, weekStartInZone } from "@/lib/time";
import { userTimeZone } from "@/lib/user-time";

export async function planMyWeek(): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const credential = await credentialForAgent(supabase, userId, "weekly_plan");
  if ("error" in credential) return credential;
  const tz = await userTimeZone(supabase, userId);
  const today = dateInZone(tz);

  const [{ data: search }, { data: jobs }, { data: contacts }, { data: offers }, { count: posts }, { count: docs }, { count: imports }] = await Promise.all([
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("jobs").select("title, company, stage, fit_score, description, stage_changed_at"),
    supabase.from("contacts").select("full_name, company, referral_status, next_follow_up_at"),
    supabase.from("offers").select("company, title, status, deadline").neq("status", "declined"),
    supabase.from("content_posts").select("id", { count: "exact", head: true }).in("status", ["idea", "draft"]).lte("planned_for", dateInZone(tz, 14)),
    supabase.from("career_documents").select("id", { count: "exact", head: true }).in("kind", ["resume", "linkedin_pdf"]),
    supabase.from("connection_imports").select("id", { count: "exact", head: true }).eq("status", "complete"),
  ]);
  const prefs = withDefaults(search);
  const all = (jobs ?? []) as Pick<Job, "title" | "company" | "stage" | "fit_score" | "description" | "stage_changed_at">[];
  const label = (j: { title: string; company: string }) => `${j.title} at ${j.company}`;
  const pipeline: Record<string, number> = {};
  for (const j of all) if (j.stage !== "dismissed") pipeline[j.stage] = (pipeline[j.stage] ?? 0) + 1;

  const snapshot: SearchSnapshot = {
    targetRoles: prefs.target_roles,
    searchMode: prefs.search_mode,
    dailyMinutes: prefs.daily_minutes,
    pipeline,
    inbox: pipeline.discovered ?? 0,
    unscored: all.filter((j) => j.stage === "saved" && j.fit_score == null && j.description).length,
    strongFits: all.filter((j) => j.stage === "saved" && (j.fit_score ?? 0) >= 70).sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)).slice(0, 5).map((j) => `${label(j)} (fit ${j.fit_score})`),
    staleApplications: all.filter((j) => j.stage === "applied" && daysSince(j.stage_changed_at) >= 10).slice(0, 5).map((j) => `${label(j)} (${daysSince(j.stage_changed_at)} days)`),
    upcomingInterviews: all.filter((j) => j.stage === "screen" || j.stage === "interview").map(label),
    offers: (offers ?? []).map((o) => `${o.title} at ${o.company} (${o.status}${o.deadline ? `, deadline ${o.deadline}` : ""})`),
    referralTargets: (contacts ?? []).filter((c) => c.referral_status === "to_ask").slice(0, 6).map((c) => `${c.full_name}${c.company ? ` at ${c.company}` : ""}`),
    followUpsDue: (contacts ?? []).filter((c) => c.next_follow_up_at && c.next_follow_up_at <= today).map((c) => c.full_name),
    postsPlanned: posts ?? 0,
    hasResume: (docs ?? 0) > 0,
    connectionsImported: (imports ?? 0) > 0,
  };

  try {
    const result = await generateStructured({ credential, tier: "standard", system: COACH_SYSTEM, prompt: buildCoachPrompt(snapshot), schema: weeklyPlanSchema, schemaName: "weekly_plan" });
    await recordAgentRun(supabase, userId, "weekly_plan", credential, result.model);
    const plan = { ...result.data, priorities: result.data.priorities.slice(0, 6).map((p) => ({ ...p, minutes: Math.max(5, Math.min(240, Math.round(p.minutes))) })) };
    const { error } = await supabase.from("weekly_plans").upsert({ user_id: userId, week_start: weekStartInZone(tz), plan, model: result.model, created_at: new Date().toISOString() });
    if (error) return { error: "Couldn't save your plan." };
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    console.error("weekly plan failed", err);
    return { error: "Couldn't write your plan. Please try again." };
  }
}
