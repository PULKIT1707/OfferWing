import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// How many more Starter-credit runs the user has today in a given agent table.
export async function starterRunsLeft(supabase: SupabaseClient, table: string, dailyLimit: number): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("credential", "starter").gte("created_at", since.toISOString());
  return Math.max(0, dailyLimit - (count ?? 0));
}

export type AgentName = "content_plan" | "post_draft" | "comment_ideas" | "story_bank" | "weekly_plan";

// Starter-credit limits for agents that log to agent_runs (they have no dedicated run table).
export const AGENT_DAILY_LIMITS: Record<AgentName, number> = { content_plan: 3, post_draft: 10, comment_ideas: 20, story_bank: 3, weekly_plan: 3 };

export async function agentRunsLeft(supabase: SupabaseClient, agent: AgentName): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("agent_runs").select("id", { count: "exact", head: true }).eq("agent", agent).eq("credential", "starter").gte("created_at", since.toISOString());
  return Math.max(0, AGENT_DAILY_LIMITS[agent] - (count ?? 0));
}

export async function recordAgentRun(supabase: SupabaseClient, userId: string, agent: AgentName, credential: { source: string; provider: string }, model: string) {
  await supabase.from("agent_runs").insert({ user_id: userId, agent, credential: credential.source, provider: credential.provider, model });
}
