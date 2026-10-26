import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { OPEN_STAGES, sameCompany } from "@/lib/dashboard";
import { allowedRuns, credentialForAgent } from "@/lib/llm/agent-credential";
import { releaseStarterRuns } from "@/lib/llm/quota";
import { modelFor } from "@/lib/llm/models";
import { isMatchRunning } from "./job-match";
import { runJobMatches } from "./job-match-runner";

export type StartResult = { queued: number; skipped: { title: string; reason: string }[]; error?: string };

// Queues fit scoring (starter or cloud key) for specific jobs, or for every open job with a description and no score.
export async function queueJobMatches(
  supabase: SupabaseClient,
  userId: string,
  jobIds: string[] | "unscored",
  // Client for the background run; defaults to the caller's client.
  backgroundClient: () => Promise<SupabaseClient> = async () => supabase,
): Promise<StartResult> {
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

  // Claims one Starter run per job up front; a batch may get fewer than it asked for.
  const credential = await credentialForAgent(supabase, userId, "job_match", eligible.length);
  if ("error" in credential) return { queued: 0, skipped, error: credential.error };
  const left = allowedRuns(credential, eligible.length);
  for (const j of eligible.slice(left)) skipped.push({ title: `${j.title} at ${j.company}`, reason: "Starter daily limit reached" });
  const batch = eligible.slice(0, left);
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
  if (error || !rows) {
    await releaseStarterRuns(credential.starterClaims ?? []);
    return { queued: 0, skipped, error: "Couldn't start scoring. Please try again." };
  }
  after(async () => {
    await runJobMatches(await backgroundClient(), userId, credential, rows.map((r) => ({ matchId: r.id, jobId: r.job_id })));
    // Jobs that failed before reaching the model never used their claim; give those back.
    await releaseStarterRuns(credential.starterClaims?.splice(0) ?? []);
  });
  return { queued: rows.length, skipped };
}
