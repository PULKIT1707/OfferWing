"use server";

import { after } from "next/server";
import { isMatchRunning, STARTER_DAILY_MATCHES, type MatchRun } from "@/lib/agents/job-match";
import { runJobMatches } from "@/lib/agents/job-match-runner";
import { requireUser } from "@/lib/auth";
import { OPEN_STAGES, sameCompany } from "@/lib/dashboard";
import { resolveCredential } from "@/lib/llm/credentials";
import { UserFacingError } from "@/lib/llm/errors";
import { modelFor } from "@/lib/llm/models";

export type StartResult = { queued: number; skipped: { title: string; reason: string }[]; error?: string };

const MATCH_COLUMNS = "id, job_id, status, model, result, error, created_at, completed_at";

// Queues fit scoring for specific jobs, or for every open job with a description and no score.
export async function startJobMatches(jobIds: string[] | "unscored"): Promise<StartResult> {
  const { supabase, userId } = await requireUser();

  let query = supabase.from("jobs").select("id, title, company, description, fit_score, stage");
  // "unscored" leaves out jobs without a description; they can't be scored and aren't counted in the UI.
  query =
    jobIds === "unscored"
      ? query.is("fit_score", null).in("stage", OPEN_STAGES).not("description", "is", null).neq("description", "")
      : query.in("id", jobIds);
  const [{ data: jobs }, { data: search }, { data: recent }] = await Promise.all([
    query,
    supabase.from("search_profiles").select("excluded_companies").eq("user_id", userId).maybeSingle(),
    supabase.from("job_matches").select("job_id, status, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const skipped: StartResult["skipped"] = [];
  const eligible = (jobs ?? []).filter((j) => {
    const reason = !j.description?.trim()
      ? "no job description"
      : search?.excluded_companies?.some((c: string) => sameCompany(c, j.company))
        ? `${j.company} is on your companies-to-avoid list`
        : isMatchRunning(recent?.find((m) => m.job_id === j.id))
          ? "already being scored"
          : null;
    if (reason) skipped.push({ title: `${j.title} at ${j.company}`, reason });
    return !reason;
  });
  if (!eligible.length) {
    return { queued: 0, skipped, error: jobIds === "unscored" && !skipped.length ? "Every open job is already scored." : undefined };
  }

  let credential;
  try {
    credential = await resolveCredential(supabase, userId);
  } catch (err) {
    if (err instanceof UserFacingError) return { queued: 0, skipped, error: err.message };
    throw err;
  }

  let batch = eligible;
  if (credential.source === "starter") {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("job_matches")
      .select("id", { count: "exact", head: true })
      .eq("credential", "starter")
      .gte("created_at", since.toISOString());
    const left = Math.max(0, STARTER_DAILY_MATCHES - (count ?? 0));
    if (!left) return { queued: 0, skipped, error: `Starter includes ${STARTER_DAILY_MATCHES} job scores a day. Add your own AI key in Settings for unlimited scoring.` };
    for (const j of batch.slice(left)) skipped.push({ title: `${j.title} at ${j.company}`, reason: "Starter daily limit reached" });
    batch = batch.slice(0, left);
  }

  const { data: rows, error } = await supabase
    .from("job_matches")
    .insert(
      batch.map((j) => ({
        user_id: userId,
        job_id: j.id,
        credential: credential.source,
        provider: credential.provider,
        model: modelFor(credential.provider, "fast"),
      })),
    )
    .select("id, job_id");
  if (error || !rows) return { queued: 0, skipped, error: "Couldn't start scoring. Please try again." };

  after(async () => {
    const { supabase: db } = await requireUser();
    await runJobMatches(db, userId, credential, rows.map((r) => ({ matchId: r.id, jobId: r.job_id })));
  });
  return { queued: rows.length, skipped };
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
