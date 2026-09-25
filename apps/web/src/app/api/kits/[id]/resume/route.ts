import { NextResponse } from "next/server";
import type { ApplicationKit } from "@/lib/agents/application-tailor";
import { buildResumeDocx } from "@/lib/resume-docx";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: RouteContext<"/api/kits/[id]/resume">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS limits this to the signed-in user's own kits.
  const { data: kit } = await supabase.from("application_kits").select("result, jobs(company)").eq("id", id).eq("status", "complete").maybeSingle();
  if (!kit?.result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = kit.result as ApplicationKit;
  const company = (kit.jobs as unknown as { company: string } | null)?.company ?? "job";
  const slug = (s: string) => s.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  const buffer = await buildResumeDocx(result);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug(result.resume.name) || "Resume"}_${slug(company)}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
