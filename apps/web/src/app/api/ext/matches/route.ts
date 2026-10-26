import { NextResponse } from "next/server";
import { z } from "zod";
import { detectDealbreakers } from "@/lib/agents/job-gates";
import { jobMatchSchema, normalizeMatch } from "@/lib/agents/job-match";
import { withDefaults } from "@/lib/onboarding";
import { jsonError, requireBearerUser } from "@/lib/api-auth";

const body = z.object({
  jobId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string().min(1).max(100),
  // Older extension builds send version-1 results without these fields; accept both.
  result: jobMatchSchema.partial({ legitimacy: true, evidence: true, open_questions: true, injected_instructions: true }),
  inputTokens: z.number().int().nullable().optional(),
  outputTokens: z.number().int().nullable().optional(),
});

// Stores a fit analysis the extension produced in Private mode (the AI call happened in the user's browser).
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid fit analysis.");
  const { jobId, provider, model, inputTokens, outputTokens } = parsed.data;
  const [{ data: job }, { data: search }] = await Promise.all([
    supabase.from("jobs").select("id, description").eq("id", jobId).maybeSingle(),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!job) return jsonError("Job not found.", 404);
  // The same code-side checks as server scoring, since the browser prompt can't see preferences.
  const result = normalizeMatch(parsed.data.result, detectDealbreakers(job.description ?? "", withDefaults(search)));

  const now = new Date().toISOString();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("job_matches").insert({
      user_id: userId,
      job_id: jobId,
      status: "complete",
      credential: "private",
      provider,
      model,
      result,
      input_tokens: inputTokens ?? null,
      output_tokens: outputTokens ?? null,
      created_at: now,
      completed_at: now,
    }),
    supabase.from("jobs").update({ fit_score: result.fit_score }).eq("id", jobId),
  ]);
  if (e1 || e2) return jsonError("Couldn't save the fit analysis.", 500);
  return NextResponse.json({ ok: true, fit_score: result.fit_score });
}
