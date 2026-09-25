import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameCompany } from "@/lib/dashboard";
import { DOCUMENT_COLUMNS, pickDocument, readDocumentText } from "@/lib/documents";
import type { Credential } from "@/lib/llm/credentials";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { withDefaults } from "@/lib/onboarding";
import { buildCandidateContext, buildJobPrompt, JOB_MATCH_SYSTEM, jobMatchSchema, normalizeMatch } from "./job-match";

const CONCURRENCY = 3;

// Scores each queued (matchId, jobId) pair and writes results back. Runs in after().
export async function runJobMatches(db: SupabaseClient, userId: string, credential: Credential, queue: { matchId: string; jobId: string }[]) {
  const fail = (matchId: string, err: unknown) => {
    if (!(err instanceof UserFacingError)) console.error("job match failed", matchId, err);
    const message = err instanceof UserFacingError ? err.message : "Couldn't score this job. Please try again.";
    return db.from("job_matches").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", matchId);
  };

  let context: string;
  let jobs: { id: string; title: string; company: string; location: string | null; description: string | null }[];
  let contacts: { company: string | null }[];
  try {
    const [{ data: search }, { data: docs }, jobsRes, contactsRes] = await Promise.all([
      db.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
      db.from("career_documents").select(DOCUMENT_COLUMNS).in("kind", ["resume", "linkedin_pdf"]).order("created_at", { ascending: false }),
      db.from("jobs").select("id, title, company, location, description").in("id", queue.map((q) => q.jobId)),
      db.from("contacts").select("company"),
    ]);
    // The resume usually has the fullest detail; fall back to the LinkedIn export.
    const doc = pickDocument(docs, "resume", "linkedin_pdf");
    const careerText = doc ? await readDocumentText(db, doc) : null;
    context = buildCandidateContext(withDefaults(search), careerText);
    jobs = jobsRes.data ?? [];
    contacts = contactsRes.data ?? [];
  } catch (err) {
    await Promise.all(queue.map((q) => fail(q.matchId, err)));
    return;
  }

  const work = [...queue];
  const worker = async () => {
    for (let item = work.shift(); item; item = work.shift()) {
      const job = jobs.find((j) => j.id === item.jobId);
      try {
        if (!job?.description) throw new UserFacingError("Paste the job description first.");
        const people = contacts.filter((c) => sameCompany(c.company, job.company)).length;
        const result = await generateStructured({
          credential,
          tier: "fast",
          system: JOB_MATCH_SYSTEM,
          context,
          prompt: buildJobPrompt({ ...job, description: job.description.slice(0, 20_000) }, people),
          schema: jobMatchSchema,
          schemaName: "job_match",
        });
        const match = normalizeMatch(result.data);
        await Promise.all([
          db
            .from("job_matches")
            .update({
              status: "complete",
              result: match,
              model: result.model,
              input_tokens: result.inputTokens,
              output_tokens: result.outputTokens,
              completed_at: new Date().toISOString(),
            })
            .eq("id", item.matchId),
          db.from("jobs").update({ fit_score: match.fit_score }).eq("id", item.jobId),
        ]);
      } catch (err) {
        await fail(item.matchId, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}
