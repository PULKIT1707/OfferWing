import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { STARTER_LIMITS, type StarterAgent } from "./starter-limits";

export { STARTER_LIMITS, starterLimitMessage, type StarterAgent } from "./starter-limits";

// Agents that log to agent_runs (they have no dedicated run table). agent_runs is a log only:
// Starter limits are enforced by the starter_usage ledger (migration 0018), never by counting it.
export type AgentName = "content_plan" | "post_draft" | "comment_ideas" | "story_bank" | "weekly_plan" | "form_answers" | "referral_packet" | "talent_profile" | "profile_prefill";

// Claims up to `count` Starter runs and returns the ledger ids granted (fewer than asked, or none,
// when the daily limit is near or reached). The database counts and inserts under one lock, and
// users can't write the ledger, so editing their own run rows no longer resets the limit.
export async function claimStarterRuns(supabase: SupabaseClient, agent: StarterAgent, count = 1): Promise<string[]> {
  const { data, error } = await supabase.rpc("claim_starter_runs", { p_agent: agent, p_count: count });
  if (error) {
    console.error("claim_starter_runs failed", agent, error.message);
    return [];
  }
  return ((data ?? []) as (string | { claim_starter_runs: string })[]).map((row) => (typeof row === "string" ? row : row.claim_starter_runs));
}

// Gives back claimed runs whose model call failed. Needs the service role (users can't refund
// themselves); without it the claim simply stays used, which is the safe direction.
export async function releaseStarterRuns(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("release_starter_runs", { p_ids: ids });
  if (error) console.error("release_starter_runs failed", error.message);
}

export async function starterRunsLeft(supabase: SupabaseClient, agent: StarterAgent): Promise<number> {
  const { data, error } = await supabase.rpc("starter_runs_left", { p_agent: agent });
  if (error || typeof data !== "number") return 0;
  return data;
}

export const AGENT_DAILY_LIMITS: Record<AgentName, number> = Object.fromEntries(
  (["content_plan", "post_draft", "comment_ideas", "story_bank", "weekly_plan", "form_answers", "referral_packet", "talent_profile", "profile_prefill"] as const).map((a) => [a, STARTER_LIMITS[a]]),
) as Record<AgentName, number>;

export async function recordAgentRun(supabase: SupabaseClient, userId: string, agent: AgentName, credential: { source: string; provider: string }, model: string) {
  await supabase.from("agent_runs").insert({ user_id: userId, agent, credential: credential.source, provider: credential.provider, model });
}
