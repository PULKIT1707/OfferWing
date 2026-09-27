import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireBearerUser } from "@/lib/api-auth";

const body = z.union([
  z.object({ jobId: z.string().uuid() }),
  z.object({ url: z.string().url().max(2000), title: z.string().trim().min(1).max(200), company: z.string().trim().min(1).max(200) }),
]);

// "I submitted it": moves the job to Applied (creating it first when it isn't in the pipeline yet).
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Add the job title and company first.");

  const now = new Date().toISOString();
  const applied = { stage: "applied", applied_at: now, stage_changed_at: now, updated_at: now, channel: "company_site" };
  const { data, error } =
    "jobId" in parsed.data
      ? await supabase.from("jobs").update(applied).eq("id", parsed.data.jobId).select("id, title, company, stage").single()
      : await supabase
          .from("jobs")
          .insert({ user_id: userId, url: parsed.data.url, title: parsed.data.title, company: parsed.data.company, source: "ats", ...applied })
          .select("id, title, company, stage")
          .single();
  if (error || !data) return jsonError("Couldn't update your pipeline. Please try again.", 500);
  return NextResponse.json({ job: data });
}
