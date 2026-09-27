import { NextResponse } from "next/server";
import type { ApplicationKit } from "@/lib/agents/application-tailor";
import { requireBearerUser } from "@/lib/api-auth";
import { latestKit } from "@/lib/autofill-server";
import { buildResumeDocx } from "@/lib/resume-docx";

const slug = (s: string) => s.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");

// The resume to attach to an application: the job's tailored .docx when a kit exists, otherwise
// the user's latest uploaded resume file.
export async function GET(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const jobId = new URL(req.url).searchParams.get("jobId");

  const kit = jobId && /^[0-9a-f-]{36}$/i.test(jobId) ? await latestKit(supabase, jobId) : null;
  if (kit) {
    const result = kit.result as unknown as ApplicationKit;
    const { data: job } = await supabase.from("jobs").select("company").eq("id", jobId!).maybeSingle();
    const buffer = await buildResumeDocx(result);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${slug(result.resume.name) || "Resume"}_${slug(job?.company ?? "")}.docx"`.replace("_.docx", ".docx"),
        "Cache-Control": "no-store",
      },
    });
  }

  const { data: doc } = await supabase.from("career_documents").select("storage_path, file_name").eq("kind", "resume").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Upload your resume in Offerwing Settings first." }, { status: 404 });
  const { data: file, error } = await supabase.storage.from("career-docs").download(doc.storage_path);
  if (error || !file) return NextResponse.json({ error: "Couldn't open your resume file." }, { status: 500 });
  return new NextResponse(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.file_name.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
