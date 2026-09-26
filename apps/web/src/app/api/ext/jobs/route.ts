import { NextResponse } from "next/server";
import { z } from "zod";
import { queueJobMatches } from "@/lib/agents/job-match-service";
import { jsonError, requireBearerUser } from "@/lib/api-auth";
import { canonicalJobUrl } from "@/lib/linkedin-urls";

export const maxDuration = 300;

const body = z.object({
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(30000).nullable().optional(),
});

// Saves the job on screen to the pipeline (or refreshes its description) and, unless the user is in
// Private mode (where the extension scores it locally), queues fit scoring.
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Couldn't read this job posting.");
  const url = canonicalJobUrl(parsed.data.url);
  if (!url) return jsonError("This doesn't look like a LinkedIn job posting.");

  const { data: existing } = await supabase.from("jobs").select("id, description").eq("url", url).maybeSingle();
  const fields = { title: parsed.data.title, company: parsed.data.company, location: parsed.data.location ?? null, url, source: "extension" as const };
  const description = parsed.data.description || null;

  const { data: job, error } = existing
    ? await supabase
        .from("jobs")
        .update({ ...fields, ...(description && description !== existing.description ? { description, fit_score: null } : {}), updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id, title, company, stage, fit_score")
        .single()
    : await supabase.from("jobs").insert({ ...fields, description, user_id: userId }).select("id, title, company, stage, fit_score").single();
  if (error || !job) return jsonError("Couldn't save the job. Please try again.", 500);

  const { data: ai } = await supabase.from("ai_settings").select("mode").eq("user_id", userId).maybeSingle();
  const scoring = ai?.mode === "private" || !description || job.fit_score != null ? null : await queueJobMatches(supabase, userId, [job.id]);
  return NextResponse.json({ job, created: !existing, scoring });
}
