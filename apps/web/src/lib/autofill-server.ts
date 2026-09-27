import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTailorContext } from "@/lib/agents/application-tailor";
import { APPLICATION_PROFILE_COLUMNS, EMPTY_APPLICATION_PROFILE, suggestedApplicationProfile, toApplicantFacts, type ApplicationProfile } from "@/lib/application-profile";
import { atsRef, type AutofillData } from "@/lib/autofill";
import { companyKey, OPEN_STAGES } from "@/lib/dashboard";
import { loadCareerText } from "@/lib/documents";
import { nameFromToken } from "@/lib/job-sources";
import { withDefaults } from "@/lib/onboarding";

export type AutofillJob = { id: string; title: string; company: string; stage: string; hasKit: boolean };

const JOB_FIELDS = "id, title, company, stage, url, external_id, created_at";
type JobRow = { id: string; title: string; company: string; stage: string; url: string | null; external_id: string | null; created_at: string };

const withoutTracking = (url: string) => {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gh_src|source|ref|lever-)/i.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\/(apply|application)\/?$/, "/");
  } catch {
    return url;
  }
};

// The pipeline job this application page belongs to (by Job Discovery id or URL), plus other
// open jobs at the same company so the user can pick when we can't tell.
export async function findJobsForPage(supabase: SupabaseClient, url: string): Promise<{ match: JobRow | null; candidates: JobRow[] }> {
  const ref = atsRef(url);
  let match: JobRow | null = null;

  if (ref?.externalId) {
    const { data } = await supabase.from("jobs").select(JOB_FIELDS).eq("external_id", ref.externalId).maybeSingle();
    match = data as JobRow | null;
  }
  if (!match && ref?.ats === "greenhouse" && ref.jobId) {
    const { data } = await supabase.from("jobs").select(JOB_FIELDS).like("external_id", `greenhouse:%:${ref.jobId}`).limit(1).maybeSingle();
    match = data as JobRow | null;
  }
  if (!match) {
    const clean = withoutTracking(url);
    const { data } = await supabase.from("jobs").select(JOB_FIELDS).in("url", [...new Set([url, clean, clean.replace(/\/$/, "")])]).limit(1).maybeSingle();
    match = data as JobRow | null;
  }

  const { data: open } = await supabase.from("jobs").select(JOB_FIELDS).in("stage", OPEN_STAGES).order("created_at", { ascending: false }).limit(200);
  const company = match?.company ?? (ref?.board ? nameFromToken(ref.board) : null);
  const key = companyKey(company);
  const sameCompany = ((open ?? []) as JobRow[]).filter((j) => key && companyKey(j.company) === key && j.id !== match?.id);
  const candidates = sameCompany.length ? sameCompany : ((open ?? []) as JobRow[]).filter((j) => j.id !== match?.id).slice(0, 30);
  return { match, candidates };
}

export async function toAutofillJobs(supabase: SupabaseClient, jobs: JobRow[]): Promise<AutofillJob[]> {
  if (!jobs.length) return [];
  const { data: kits } = await supabase.from("application_kits").select("job_id").eq("status", "complete").in("job_id", jobs.map((j) => j.id));
  const withKit = new Set((kits ?? []).map((k) => k.job_id));
  return jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, stage: j.stage, hasKit: withKit.has(j.id) }));
}

export async function latestKit(supabase: SupabaseClient, jobId: string) {
  const { data } = await supabase
    .from("application_kits")
    .select("id, result")
    .eq("job_id", jobId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; result: { screening_answers?: { question: string; answer: string }[]; cover_note?: string } } | null;
}

export async function loadApplicationProfile(supabase: SupabaseClient, userId: string, email: string | null): Promise<{ profile: ApplicationProfile; saved: boolean }> {
  const [{ data: row }, { data: profile }] = await Promise.all([
    supabase.from("application_profiles").select(APPLICATION_PROFILE_COLUMNS).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
  ]);
  if (row) return { profile: { ...EMPTY_APPLICATION_PROFILE, ...(row as ApplicationProfile) }, saved: true };
  return { profile: suggestedApplicationProfile(profile?.full_name ?? null, email), saved: false };
}

export async function loadAutofillData(supabase: SupabaseClient, userId: string, email: string | null, jobId: string | null): Promise<AutofillData & { profileSaved: boolean; kitId: string | null }> {
  const [{ profile, saved }, { data: search }, { data: docs }, kit] = await Promise.all([
    loadApplicationProfile(supabase, userId, email),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("kind").in("kind", ["resume", "linkedin_pdf"]),
    jobId ? latestKit(supabase, jobId) : Promise.resolve(null),
  ]);
  return {
    facts: toApplicantFacts(profile, withDefaults(search)),
    answers: (kit?.result.screening_answers ?? []).slice(0, 20),
    coverNote: kit?.result.cover_note ?? null,
    hasResume: !!kit || !!docs?.some((d) => d.kind === "resume"),
    profileSaved: saved,
    kitId: kit?.id ?? null,
  };
}

// The same candidate context the Application Tailor uses (documents, voice, salary, sponsorship).
export async function loadTailorContext(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const [careerText, { data: search }] = await Promise.all([loadCareerText(supabase), supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle()]);
  if (!careerText) return null;
  const profile = withDefaults(search);
  const salary =
    profile.salary_min != null || profile.salary_target != null ? `${profile.salary_min ?? "?"}-${profile.salary_target ?? "?"} ${profile.salary_currency}` : "not specified";
  return buildTailorContext({ careerText, voiceSamples: profile.voice_samples, salary, needsSponsorship: profile.needs_sponsorship, searchMode: profile.search_mode });
}
