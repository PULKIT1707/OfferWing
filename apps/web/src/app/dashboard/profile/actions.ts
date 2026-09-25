"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { buildProfileOptimizerPrompt, isAuditRunning, normalizeAudit, PROFILE_OPTIMIZER_SYSTEM, profileAuditSchema } from "@/lib/agents/profile-optimizer";
import { requireUser } from "@/lib/auth";
import { DOCUMENT_COLUMNS, pickDocument, readDocumentText } from "@/lib/documents";
import { resolveCredential, STARTER_DAILY_AUDITS } from "@/lib/llm/credentials";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { modelFor } from "@/lib/llm/models";
import { withDefaults } from "@/lib/onboarding";

export async function startProfileAudit(): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();

  const { data: latest } = await supabase
    .from("profile_audits")
    .select("status, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (isAuditRunning(latest)) {
    return { error: "An audit is already running." };
  }

  // Prefer the LinkedIn export; fall back to the resume.
  const { data: docs } = await supabase
    .from("career_documents")
    .select(DOCUMENT_COLUMNS)
    .in("kind", ["linkedin_pdf", "resume"])
    .order("created_at", { ascending: false });
  const doc = pickDocument(docs, "linkedin_pdf", "resume");
  if (!doc) return { error: "Upload your LinkedIn profile PDF or resume first." };

  let credential;
  try {
    credential = await resolveCredential(supabase, userId);
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }

  if (credential.source === "starter") {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("profile_audits")
      .select("id", { count: "exact", head: true })
      .eq("credential", "starter")
      .gte("created_at", since.toISOString());
    if ((count ?? 0) >= STARTER_DAILY_AUDITS) {
      return { error: `Starter includes ${STARTER_DAILY_AUDITS} audits a day. Add your own AI key in Settings for unlimited runs.` };
    }
  }

  const { data: run, error } = await supabase
    .from("profile_audits")
    .insert({
      user_id: userId,
      source_kind: doc.kind,
      source_file_name: doc.file_name,
      credential: credential.source,
      provider: credential.provider,
      model: modelFor(credential.provider, "premium"),
    })
    .select("id")
    .single();
  if (error || !run) return { error: "Couldn't start the audit. Please try again." };

  // The model call takes 30-120s, so it runs after the response; the page polls for the result.
  after(async () => {
    const { supabase: db } = await requireUser();
    try {
      const [{ data: search }, text] = await Promise.all([
        db.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
        readDocumentText(db, doc),
      ]);
      const result = await generateStructured({
        credential,
        tier: "premium",
        system: PROFILE_OPTIMIZER_SYSTEM,
        prompt: buildProfileOptimizerPrompt(withDefaults(search), doc.kind as "linkedin_pdf" | "resume", text),
        schema: profileAuditSchema,
        schemaName: "profile_audit",
      });
      await db
        .from("profile_audits")
        .update({
          status: "complete",
          result: normalizeAudit(result.data),
          model: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    } catch (err) {
      const message = err instanceof UserFacingError ? err.message : "Something went wrong while auditing your profile. Please try again.";
      if (!(err instanceof UserFacingError)) console.error("profile audit failed", run.id, err);
      await db.from("profile_audits").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", run.id);
    }
  });

  revalidatePath("/dashboard/profile");
  return {};
}
