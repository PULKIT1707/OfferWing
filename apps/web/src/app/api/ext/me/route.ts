import { NextResponse } from "next/server";
import { requireBearerUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;

  const [{ data: profile }, { data: ai }, { data: search }, { data: docs }, { data: lastImport }, { data: application }] = await Promise.all([
    supabase.from("profiles").select("full_name, onboarding_step").eq("id", userId).single(),
    supabase.from("ai_settings").select("mode, provider").eq("user_id", userId).maybeSingle(),
    supabase.from("search_profiles").select("target_roles").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("kind"),
    supabase.from("connection_imports").select("completed_at").eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("application_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  return NextResponse.json({
    name: profile?.full_name ?? null,
    onboarded: profile?.onboarding_step === "done",
    aiMode: ai?.mode ?? "starter",
    aiProvider: ai?.provider ?? null,
    targetRoles: search?.target_roles ?? [],
    hasResume: docs?.some((d) => d.kind === "resume" || d.kind === "linkedin_pdf") ?? false,
    connectionsImported: !!lastImport,
    hasApplicationProfile: !!application,
  });
}
