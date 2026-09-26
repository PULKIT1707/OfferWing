import { NextResponse } from "next/server";
import { loadPrefs, pollSources } from "@/lib/discovery";
import { isCronRequest } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

// Scheduled: polls every followed career board (least recently checked first).
export async function GET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const { data: sources } = await admin
    .from("job_sources")
    .select("id, user_id, kind, board_token, company_name, only_matching")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (!sources?.length) return NextResponse.json({ checked: 0, added: 0 });
  const prefs = await loadPrefs(admin, [...new Set(sources.map((s) => s.user_id))]);
  return NextResponse.json(await pollSources(admin, sources, prefs));
}
