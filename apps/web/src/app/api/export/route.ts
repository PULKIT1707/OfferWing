import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const [profile, search, ai, documents, jobs, contacts, connections, drafts] = await Promise.all([
    supabase.from("profiles").select("full_name, alert_alias, created_at").eq("id", userId).single(),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_settings").select("mode, provider, key_last4").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("kind, file_name, size_bytes, created_at"),
    supabase.from("jobs").select("*"),
    supabase.from("contacts").select("*"),
    supabase.from("connections").select("full_name, profile_url, company, position, connected_on, message_count, last_message_at"),
    supabase.from("outreach_drafts").select("kind, result, created_at"),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    email: claims.claims.email ?? null,
    profile: profile.data,
    search_profile: search.data,
    ai_settings: ai.data,
    documents: documents.data,
    jobs: jobs.data,
    contacts: contacts.data,
    imported_connections: connections.data,
    outreach_drafts: drafts.data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="offerwing-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
