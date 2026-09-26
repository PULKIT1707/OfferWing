import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_COLUMNS, ownCompanyKeysFrom, roleTermsFrom, scoreConnection, type Connection, type ScoredConnection } from "@/lib/agents/referral-scout";
import { CONTACT_COLUMNS, OPEN_STAGES, type Contact } from "@/lib/dashboard";

export type ScoringContext = { roleTerms: string[]; ownCompanyKeys: Set<string> };

// Inputs for referral scoring: the user's target roles and open job titles, plus companies they've worked at.
export async function loadScoringContext(supabase: SupabaseClient, userId: string): Promise<ScoringContext> {
  const [{ data: search }, { data: jobs }, { data: lastComplete }] = await Promise.all([
    supabase.from("search_profiles").select("target_roles").eq("user_id", userId).maybeSingle(),
    supabase.from("jobs").select("title").in("stage", OPEN_STAGES),
    supabase.from("connection_imports").select("stats").eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    roleTerms: roleTermsFrom(...(search?.target_roles ?? []), ...(jobs ?? []).map((j) => j.title)),
    ownCompanyKeys: ownCompanyKeysFrom(((lastComplete?.stats as { ownCompanies?: string[] } | null)?.ownCompanies) ?? []),
  };
}

export async function scoredPeopleAt(supabase: SupabaseClient, ctx: ScoringContext, companyKey: string): Promise<ScoredConnection[]> {
  const { data } = await supabase.from("connections").select(CONNECTION_COLUMNS).eq("company_key", companyKey);
  return ((data ?? []) as Connection[]).map((c) => scoreConnection(c, ctx)).sort((a, b) => b.score - a.score);
}

// Adds (or reuses) a referral-list contact for an imported connection.
export async function ensureContactForConnection(supabase: SupabaseClient, userId: string, c: Connection, jobId: string | null): Promise<Contact | null> {
  const { data: existing } = await supabase.from("contacts").select(CONTACT_COLUMNS).eq("connection_id", c.id).maybeSingle();
  if (existing) {
    if (jobId && !existing.job_id) {
      const { data } = await supabase.from("contacts").update({ job_id: jobId }).eq("id", existing.id).select(CONTACT_COLUMNS).single();
      return (data as Contact) ?? (existing as Contact);
    }
    return existing as Contact;
  }
  const { data } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      connection_id: c.id,
      full_name: c.full_name,
      company: c.company,
      title: c.position,
      relationship: "connection",
      strength: c.message_count > 20 ? 3 : c.message_count > 0 ? 2 : 1,
      linkedin_url: c.profile_url,
      referral_status: "to_ask",
      job_id: jobId,
    })
    .select(CONTACT_COLUMNS)
    .single();
  return (data as Contact) ?? null;
}
