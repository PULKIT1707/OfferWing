"use server";

import { isMatchRunning, type MatchRun } from "@/lib/agents/job-match";
import { queueJobMatches, type StartResult } from "@/lib/agents/job-match-service";
import { requireUser } from "@/lib/auth";

export type { StartResult };

const MATCH_COLUMNS = "id, job_id, status, model, result, error, created_at, completed_at";

export async function startJobMatches(jobIds: string[] | "unscored"): Promise<StartResult> {
  const { supabase, userId } = await requireUser();
  return queueJobMatches(supabase, userId, jobIds, async () => (await requireUser()).supabase);
}

export async function getLatestMatch(jobId: string): Promise<MatchRun | null> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("job_matches").select(MATCH_COLUMNS).eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as MatchRun | null) ?? null;
}

// Board polling: which jobs are still being scored, and current scores.
export async function getScoringStatus(): Promise<{ running: string[]; scores: Record<string, number | null> }> {
  const { supabase } = await requireUser();
  const [{ data: recent }, { data: jobs }] = await Promise.all([
    supabase.from("job_matches").select("job_id, status, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("jobs").select("id, fit_score"),
  ]);
  const latest = new Map<string, { status: string; created_at: string }>();
  for (const m of recent ?? []) if (!latest.has(m.job_id)) latest.set(m.job_id, m);
  return {
    running: [...latest.entries()].filter(([, m]) => isMatchRunning(m)).map(([id]) => id),
    scores: Object.fromEntries((jobs ?? []).map((j) => [j.id, j.fit_score])),
  };
}
