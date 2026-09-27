import { NextResponse } from "next/server";
import type { ApplicationKit } from "@/lib/agents/application-tailor";
import { buildResumeDocx } from "@/lib/resume-docx";
import { createClient } from "@/lib/supabase/server";

const slug = (s: string) => s.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");

// The tailored resume behind a live referral packet (only when the candidate chose to include it).
export async function GET(_req: Request, ctx: RouteContext<"/r/[token]/resume">) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{32}$/.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_referral_packet_resume", { p_token: token });
  const row = data as { result: ApplicationKit; company: string } | null;
  if (!row?.result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await buildResumeDocx(row.result);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug(row.result.resume.name) || "Resume"}_${slug(row.company)}.docx"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
