import type { Metadata } from "next";
import { NetworkView } from "@/components/dashboard/NetworkView";
import type { ScoutState } from "@/components/dashboard/ReferralScout";
import { CONNECTION_COLUMNS, isImportRunning, ownCompanyKeysFrom, roleTermsFrom, scoreConnection, type Connection } from "@/lib/agents/referral-scout";
import { requireUser } from "@/lib/auth";
import { companyKey, CONTACT_COLUMNS, JOB_COLUMNS, OPEN_STAGES, type Contact, type Job } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Referrals & network · Offerwing" };

// Drafting a referral ask calls the AI model from a server action on this route.
export const maxDuration = 60;

export default async function NetworkPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: contacts }, { data: jobs }, { data: search }, { data: exportDoc }, { data: lastImport }, { data: lastComplete }] = await Promise.all([
    supabase.from("contacts").select(`${CONTACT_COLUMNS}, connection_id`).order("full_name"),
    supabase.from("jobs").select(JOB_COLUMNS),
    supabase.from("search_profiles").select("dream_companies, target_roles").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("id").eq("kind", "linkedin_export").limit(1).maybeSingle(),
    supabase.from("connection_imports").select("status, error, stats, created_at, completed_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("connection_imports").select("stats, created_at, completed_at").eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const allJobs = (jobs ?? []) as Job[];
  const openJobs = allJobs.filter((j) => OPEN_STAGES.includes(j.stage));

  // Target companies: dream companies plus companies with open jobs, deduplicated by normalized name.
  const targetNames = [...(search?.dream_companies ?? []), ...openJobs.map((j) => j.company)];
  const targets = new Map<string, string>();
  for (const name of targetNames) {
    const key = companyKey(name);
    if (key && !targets.has(key)) targets.set(key, name);
  }

  let scoutTargets: ScoutState["targets"] = [];
  // A failed re-import leaves the previous connections in place, so keep showing them.
  if (lastComplete && targets.size) {
    const { data: conns } = await supabase.from("connections").select(CONNECTION_COLUMNS).in("company_key", [...targets.keys()]);
    const stats = lastComplete.stats as { ownCompanies?: string[] } | null;
    const ctx = { roleTerms: roleTermsFrom(...(search?.target_roles ?? []), ...openJobs.map((j) => j.title)), ownCompanyKeys: ownCompanyKeysFrom(stats?.ownCompanies ?? []) };
    scoutTargets = [...targets.entries()].map(([key, company]) => ({
      company,
      jobs: openJobs.filter((j) => companyKey(j.company) === key).map((j) => ({ id: j.id, title: j.title })),
      people: ((conns ?? []) as Connection[])
        .filter((c) => c.company_key === key)
        .map((c) => scoreConnection(c, ctx))
        .sort((a, b) => b.score - a.score),
    }));
    // Companies with open jobs first, then by the strongest referrer.
    scoutTargets.sort((a, b) => Number(b.jobs.length > 0) - Number(a.jobs.length > 0) || (b.people[0]?.score ?? 0) - (a.people[0]?.score ?? 0));
  }

  const scout: ScoutState = {
    hasExport: !!exportDoc,
    lastImport: lastImport
      ? {
          status: lastImport.status as "running" | "complete" | "failed",
          error: lastImport.error,
          created_at: lastImport.created_at,
          completed_at: lastImport.completed_at,
          stats: lastImport.stats as { connections: number } | null,
          running: isImportRunning(lastImport),
        }
      : null,
    lastComplete: lastComplete
      ? { completed_at: lastComplete.completed_at ?? lastComplete.created_at, connections: (lastComplete.stats as { connections?: number } | null)?.connections ?? 0 }
      : null,
    targets: scoutTargets,
    onList: (contacts ?? []).map((c) => c.connection_id).filter(Boolean) as string[],
  };

  return <NetworkView initialContacts={(contacts ?? []) as Contact[]} jobs={allJobs} dreamCompanies={search?.dream_companies ?? []} scout={scout} />;
}
