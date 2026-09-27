import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireBearerUser } from "@/lib/api-auth";
import { atsRef } from "@/lib/autofill";
import { findJobsForPage, loadAutofillData, toAutofillJobs } from "@/lib/autofill-server";

const body = z.object({ url: z.string().url().max(2000), jobId: z.string().uuid().nullable().optional() });

// Everything the side panel needs to fill the application form on screen: which pipeline job it
// is, the user's application details, and the job's kit answers and cover note.
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId, email } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");

  const { match, candidates } = await findJobsForPage(supabase, parsed.data.url);
  const [matchJobs, candidateJobs] = await Promise.all([toAutofillJobs(supabase, match ? [match] : []), toAutofillJobs(supabase, candidates)]);
  const chosen = parsed.data.jobId ? [...matchJobs, ...candidateJobs].find((j) => j.id === parsed.data.jobId) ?? null : (matchJobs[0] ?? null);
  const data = await loadAutofillData(supabase, userId, email, chosen?.id ?? null);

  return NextResponse.json({
    ats: atsRef(parsed.data.url)?.ats ?? null,
    job: chosen,
    matched: !!matchJobs[0] && chosen?.id === matchJobs[0].id,
    candidates: candidateJobs,
    ...data,
  });
}
