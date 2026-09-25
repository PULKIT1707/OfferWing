import { Check, Pencil, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuditPanel } from "@/components/dashboard/AuditPanel";
import { isAuditRunning, type AuditRun } from "@/lib/agents/profile-optimizer";
import { requireUser } from "@/lib/auth";
import { LINKEDIN_TIERS, SENIORITY } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Profile health · Offerwing" };

// The audit runs in after() on this route, so give it room to finish.
export const maxDuration = 300;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 last:border-0 sm:flex-row sm:gap-6">
      <dt className="w-44 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted">Not set</span>}</dd>
    </div>
  );
}

const chips = (items: string[] | null | undefined) =>
  items?.length ? (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-full bg-card px-2.5 py-0.5">{i}</span>
      ))}
    </span>
  ) : null;

export default async function ProfilePage() {
  const { supabase, userId } = await requireUser();
  const [{ data: s }, { data: docs }, { data: audit }, { data: ai }] = await Promise.all([
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("kind, file_name"),
    supabase
      .from("profile_audits")
      .select("id, status, source_kind, source_file_name, credential, provider, model, result, error, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("ai_settings").select("mode").eq("user_id", userId).maybeSingle(),
  ]);
  const has = (k: string) => docs?.some((d) => d.kind === k) ?? false;

  const checks = [
    ["Target roles defined", !!s?.target_roles?.length],
    ["Locations and work mode set", !!s?.locations?.length && !!s?.work_modes?.length],
    ["Salary expectations set", s?.salary_min != null || s?.salary_target != null],
    ["Resume uploaded", has("resume")],
    ["LinkedIn profile PDF uploaded", has("linkedin_pdf")],
    ["LinkedIn data export uploaded", has("linkedin_export")],
    ["Writing samples added (for your voice)", !!s?.voice_samples],
    ["Dream companies listed", !!s?.dream_companies?.length],
  ] as const;
  const score = Math.round((checks.filter(([, ok]) => ok).length / checks.length) * 100);
  const salary =
    s?.salary_min != null || s?.salary_target != null
      ? `${[s?.salary_min, s?.salary_target].filter((n) => n != null).map((n) => Number(n).toLocaleString()).join(" – ")} ${s?.salary_currency}`
      : null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="headline text-3xl font-semibold sm:text-4xl">Profile health</h1>
          <p className="mt-2 text-muted">How ready your agents are to work for you, and what they&apos;re optimizing for.</p>
        </div>
        <Link href="/dashboard/settings#search" className="inline-flex items-center gap-2 self-start rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium hover:border-wing hover:text-wing">
          <Pencil className="size-4" /> Edit answers
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-3xl bg-white p-6">
          <p className="text-sm font-medium">Setup readiness</p>
          <div className="mt-5 flex items-center gap-5">
            <div className="grid size-24 place-items-center rounded-full" style={{ background: `conic-gradient(var(--wing) 0 ${score}%, var(--card) ${score}% 100%)` }}>
              <div className="grid size-[4.75rem] place-items-center rounded-full bg-white text-2xl font-semibold">{score}</div>
            </div>
            <p className="text-sm text-muted">The more your agents know, the better their matches, drafts and referral picks.</p>
          </div>
          <ul className="mt-6 space-y-2.5">
            {checks.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-wing text-white" : "bg-card text-muted"}`}>
                  {ok ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <span className={ok ? "" : "text-muted"}>{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6">
            <p className="text-sm font-medium">What your agents are targeting</p>
            <dl className="mt-3">
              <Row label="Roles" value={chips(s?.target_roles)} />
              <Row label="Seniority" value={SENIORITY.find(([v]) => v === s?.seniority)?.[1]} />
              <Row label="Industries" value={chips(s?.industries) ?? "Any"} />
              <Row label="Locations" value={chips(s?.locations)} />
              <Row label="Work mode" value={chips(s?.work_modes?.map((m: string) => m[0].toUpperCase() + m.slice(1)))} />
              <Row label="Salary" value={salary} />
              <Row label="Search mode" value={s?.search_mode === "stealth" ? "Stealth (discreet)" : "Open"} />
              <Row label="LinkedIn plan" value={LINKEDIN_TIERS.find(([v]) => v === s?.linkedin_tier)?.[1]} />
              <Row label="Dream companies" value={chips(s?.dream_companies)} />
            </dl>
          </section>

        </div>
      </div>

      <AuditPanel
        run={(audit ?? null) as AuditRun | null}
        running={isAuditRunning(audit)}
        hasDocument={has("linkedin_pdf") || has("resume")} aiMode={(ai?.mode ?? "starter") as "starter" | "private" | "cloud"} />
    </div>
  );
}
