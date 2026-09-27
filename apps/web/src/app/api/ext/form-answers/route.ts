import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFormAnswersPrompt, FORM_ANSWERS_SYSTEM, formAnswersSchema, openQuestionSchema } from "@/lib/agents/form-answers";
import { jsonError, requireBearerUser } from "@/lib/api-auth";
import { loadTailorContext } from "@/lib/autofill-server";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";

export const maxDuration = 120;

const body = z.object({
  jobId: z.string().uuid().nullable(),
  questions: z.array(openQuestionSchema).min(1).max(15),
  // Private mode: return the prompt so the extension can call the user's provider itself.
  prepareOnly: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");
  const { jobId, questions, prepareOnly } = parsed.data;

  try {
    const [context, { data: job }] = await Promise.all([
      loadTailorContext(supabase, userId),
      jobId ? supabase.from("jobs").select("title, company, description").eq("id", jobId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!context) return jsonError("Upload your resume (or LinkedIn PDF) in Offerwing Settings first.");
    const prompt = buildFormAnswersPrompt(job, questions);
    if (prepareOnly) return NextResponse.json({ context, prompt });

    const credential = await credentialForAgent(supabase, userId, "form_answers");
    if ("error" in credential) return jsonError(credential.error);
    const result = await generateStructured({ credential, tier: "standard", system: FORM_ANSWERS_SYSTEM, context, prompt, schema: formAnswersSchema, schemaName: "form_answers" });
    await recordAgentRun(supabase, userId, "form_answers", credential, result.model);
    return NextResponse.json({ answers: result.data.answers });
  } catch (err) {
    if (err instanceof UserFacingError) return jsonError(err.message);
    console.error("form answers failed", err);
    return jsonError("Couldn't draft answers. Please try again.", 500);
  }
}
