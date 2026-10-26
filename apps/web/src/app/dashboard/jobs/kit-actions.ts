"use server";

import { after } from "next/server";
import { APPLICATION_TAILOR_SYSTEM, applicationKitSchema, buildTailorContext, buildTailorPrompt, isKitRunning, normalizeKit } from "@/lib/agents/application-tailor";
import type { JobMatch } from "@/lib/agents/job-match";
import { verifyKit } from "@/lib/agents/truthfulness";
import { requireUser } from "@/lib/auth";
import { DOCUMENT_COLUMNS, readDocumentText, type StoredDocument } from "@/lib/documents";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { modelFor } from "@/lib/llm/models";
import { withDefaults } from "@/lib/onboarding";

export async function startApplicationKit(jobId: string): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();

  const [{ data: job }, { data: latest }, { data: docs }] = await Promise.all([
    supabase.from("jobs").select("id, title, company, location, description").eq("id", jobId).maybeSingle(),
    supabase.from("application_kits").select("status, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("career_documents").select(DOCUMENT_COLUMNS).in("kind", ["resume", "linkedin_pdf"]).order("created_at", { ascending: false }),
  ]);
  if (!job) return { error: "Job not found." };
  if (!job.description?.trim()) return { error: "Paste the job description first." };
  if (isKitRunning(latest)) return { error: "This application kit is already being written." };
  if (!docs?.length) return { error: "Upload your resume (or LinkedIn PDF) in Settings first." };

  const credential = await credentialForAgent(supabase, userId, "application_kit");
  if ("error" in credential) return credential;
  const { data: run, error } = await supabase
    .from("application_kits")
    .insert({ user_id: userId, job_id: jobId, credential: credential.source, provider: credential.provider, model: modelFor(credential.provider, "standard") })
    .select("id")
    .single();
  if (error || !run) return { error: "Couldn't start tailoring. Please try again." };

  after(async () => {
    const { supabase: db } = await requireUser();
    try {
      // Use every document as source material: more evidence for the truthfulness check.
      const latestOfKind = (kind: string) => (docs as StoredDocument[]).find((d) => d.kind === kind);
      const texts = await Promise.all(
        ["resume", "linkedin_pdf"].map((k) => latestOfKind(k)).filter((d): d is StoredDocument => !!d).map((d) => readDocumentText(db, d)),
      );
      const careerText = texts.join("\n\n---\n\n");

      const [{ data: search }, { data: match }] = await Promise.all([
        db.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
        db.from("job_matches").select("result").eq("job_id", jobId).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const profile = withDefaults(search);
      const salary =
        profile.salary_min != null || profile.salary_target != null
          ? `${profile.salary_min ?? "?"}-${profile.salary_target ?? "?"} ${profile.salary_currency}`
          : "not specified";

      const result = await generateStructured({
        credential,
        tier: "standard",
        system: APPLICATION_TAILOR_SYSTEM,
        context: buildTailorContext({ careerText, voiceSamples: profile.voice_samples, salary, needsSponsorship: profile.needs_sponsorship, searchMode: profile.search_mode }),
        prompt: buildTailorPrompt({ ...job, description: job.description!.slice(0, 20_000) }, (match?.result as JobMatch | undefined) ?? null),
        schema: applicationKitSchema,
        schemaName: "application_kit",
      });
      const kit = normalizeKit(result.data);
      await db
        .from("application_kits")
        .update({
          status: "complete",
          result: kit,
          verification: verifyKit(kit, careerText),
          model: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    } catch (err) {
      if (!(err instanceof UserFacingError)) console.error("application kit failed", run.id, err);
      const message = err instanceof UserFacingError ? err.message : "Something went wrong while tailoring. Please try again.";
      await db.from("application_kits").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", run.id);
    }
  });
  return {};
}
