import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled daily: enforces the data-retention promises made in the product (see public.purge_stale_data).
export async function GET(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { data, error } = await admin.rpc("purge_stale_data");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
