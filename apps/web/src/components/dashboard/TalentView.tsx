"use client";

import { AlertTriangle, Check, EyeOff, Inbox, Loader2, Radar, RefreshCw, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buildTalentProfile, deleteTalentProfile, respondToIntro, saveTalentProfile, setTalentVisibility, type TalentEdit } from "@/app/dashboard/talent/actions";
import { ChipInput, inputClass } from "@/components/onboarding/fields";
import type { Verification } from "@/lib/agents/truthfulness";
import { SENIORITY } from "@/lib/onboarding";
import { AVAILABILITY } from "@/lib/talent";
import { Button, PageHeader } from "./ui";

export type TalentRow = {
  public_id: string;
  visible: boolean;
  status: "generating" | "draft" | "failed";
  headline: string | null;
  summary: string | null;
  roles: string[];
  seniority: string | null;
  years_experience: number | null;
  industries: string[];
  locations: string[];
  work_modes: string[];
  open_to_relocate: boolean;
  needs_sponsorship: boolean;
  salary_min: number | null;
  salary_currency: string;
  skills: string[];
  highlights: { text: string; evidence: string }[];
  availability: TalentEdit["availability"];
  hidden_companies: string[];
  verification: Verification | null;
  error: string | null;
  published_at: string | null;
  updated_at: string;
};

export type IntroForMe = {
  id: string;
  org_name: string;
  org_website: string | null;
  role_title: string;
  role_url: string | null;
  location: string | null;
  salary_range: string | null;
  message: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  job_id: string | null;
  created_at: string;
};

function Polling() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

const editFrom = (t: TalentRow | null): TalentEdit => ({
  headline: t?.headline ?? "",
  summary: t?.summary ?? "",
  skills: t?.skills ?? [],
  highlights: t?.highlights ?? [],
  availability: t?.availability ?? "now",
  hidden_companies: t?.hidden_companies ?? [],
});

function Intros({ intros }: { intros: IntroForMe[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  if (!intros.length) return null;
  const respond = (id: string, accept: boolean) =>
    start(async () => {
      setError(undefined);
      const r = await respondToIntro(id, accept);
      if (r.error) setError(r.error);
      router.refresh();
    });
  return (
    <section className="mb-8 rounded-3xl bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Inbox className="size-5 text-wing" /> Intro requests</h2>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 space-y-3">
        {intros.map((i) => (
          <article key={i.id} className="rounded-2xl border border-line p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">{i.role_title}</p>
                <p className="text-sm text-muted">
                  {i.org_website ? <a href={i.org_website} target="_blank" rel="noreferrer" className="hover:text-wing">{i.org_name}</a> : i.org_name}
                  {[i.location, i.salary_range].filter(Boolean).map((x) => ` · ${x}`)}
                </p>
              </div>
              {i.status !== "pending" && (
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${i.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-card text-muted"}`}>{i.status}</span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{i.message}</p>
            {i.role_url && <a href={i.role_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-wing hover:underline">View the role</a>}
            {i.status === "pending" ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => respond(i.id, true)} disabled={pending}><Check className="size-4" /> Accept and share my contact details</Button>
                <Button variant="ghost" onClick={() => respond(i.id, false)} disabled={pending}><X className="size-4" /> Decline</Button>
              </div>
            ) : i.status === "accepted" && i.job_id ? (
              <Link href="/dashboard/jobs" className="mt-3 inline-block text-sm font-medium text-wing hover:underline">In your pipeline → prepare an application kit</Link>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Accepting shares your name, email, phone and LinkedIn with that team only, and adds the role to your pipeline. Declining tells them nothing else.</p>
    </section>
  );
}

export function TalentView({ talent, generating, intros }: { talent: TalentRow | null; generating: boolean; intros: IntroForMe[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<TalentEdit>(editFrom(talent));
  const [seen, setSeen] = useState(talent?.updated_at);
  if (talent?.updated_at !== seen && !pending) {
    setSeen(talent?.updated_at);
    setForm(editFrom(talent));
  }
  const set = (patch: Partial<TalentEdit>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };
  const act = (fn: () => Promise<{ error?: string }>, onOk?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (r.error) setError(r.error);
      else onOk?.();
      router.refresh();
    });

  const ready = talent?.status === "draft" && !generating;
  const removed = talent?.verification?.flagged.filter((f) => f.where.startsWith("Highlight")) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      {generating && <Polling />}
      <PageHeader
        title="Get discovered"
        subtitle="An anonymous, fact-checked profile that verified recruiters can find. You decide who learns who you are."
        action={
          ready ? (
            <Button variant={talent!.visible ? "ghost" : "primary"} onClick={() => act(() => setTalentVisibility(!talent!.visible))} disabled={pending}>
              {talent!.visible ? <><EyeOff className="size-4" /> Hide my profile</> : <><Radar className="size-4" /> Make me discoverable</>}
            </Button>
          ) : undefined
        }
      />
      <Intros intros={intros} />
      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!talent || (talent.status === "failed" && !generating) || (talent.status === "generating" && !generating) ? (
        <div className="rounded-3xl bg-white p-10 text-center">
          {talent?.status === "failed" || talent?.status === "generating" ? (
            <>
              <AlertTriangle className="mx-auto size-7 text-amber-500" />
              <p className="mt-3 font-medium">The last build didn&apos;t finish</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{talent.error ?? "It took too long and was stopped."}</p>
            </>
          ) : (
            <>
              <Radar className="mx-auto size-8 text-wing" />
              <p className="mt-3 font-medium">Let the right roles come to you</p>
              <ul className="mx-auto mt-3 max-w-md space-y-1.5 text-left text-sm text-muted">
                <li>• Anonymous: no name, employer, school or contact details. Your current employer can&apos;t see you.</li>
                <li>• Only teams Offerwing has verified can search, and each intro request needs your yes.</li>
                <li>• Every highlight is checked against your own resume, which is why recruiters trust it.</li>
                <li>• Hidden until you switch it on. Turn it off any time.</li>
              </ul>
            </>
          )}
          <Button className="mt-6" onClick={() => act(buildTalentProfile)} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Build my anonymous profile
          </Button>
        </div>
      ) : generating ? (
        <div className="rounded-3xl bg-white p-10 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-wing" />
          <p className="mt-4 font-medium">Writing your anonymous profile…</p>
          <p className="mt-1 text-sm text-muted">Usually 30 to 60 seconds. Names and employers are then removed and every highlight is checked.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className={`flex items-start gap-3 rounded-3xl p-5 text-sm ${talent.visible ? "bg-emerald-50 text-emerald-900" : "bg-card text-muted"}`}>
              {talent.visible ? <Radar className="mt-0.5 size-5 shrink-0" /> : <EyeOff className="mt-0.5 size-5 shrink-0" />}
              <p>
                {talent.visible
                  ? `You're discoverable as candidate ${talent.public_id}. Verified recruiters can see this profile and request an intro.`
                  : "Your profile is hidden. Review it, then click “Make me discoverable”."}
              </p>
            </div>

            {removed.length > 0 && (
              <p className="rounded-3xl bg-amber-50 p-5 text-sm text-amber-950">
                We left out {removed.length} highlight{removed.length === 1 ? "" : "s"} we couldn&apos;t trace to your documents.
              </p>
            )}

            <section className="space-y-5 rounded-3xl bg-white p-6">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted"><ShieldCheck className="size-4 text-emerald-600" /> What recruiters see</p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Headline</span>
                <input className={inputClass} value={form.headline} onChange={(e) => set({ headline: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Summary</span>
                <textarea className={`${inputClass} min-h-28`} value={form.summary} onChange={(e) => set({ summary: e.target.value })} />
              </label>
              <div>
                <p className="mb-1.5 text-sm font-medium">Highlights</p>
                <div className="space-y-2">
                  {form.highlights.map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <textarea
                        className={`${inputClass} min-h-14`}
                        value={h.text}
                        onChange={(e) => set({ highlights: form.highlights.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                      />
                      <button type="button" aria-label="Remove highlight" onClick={() => set({ highlights: form.highlights.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-muted hover:bg-card hover:text-red-600">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Skills</p>
                <ChipInput value={form.skills} onChange={(v) => set({ skills: v })} placeholder="Add a skill" max={20} />
              </div>
              <p className="text-xs text-muted">
                Also shown: {[talent.roles.join(" / "), SENIORITY.find(([v]) => v === talent.seniority)?.[1], talent.years_experience ? `${talent.years_experience} years` : null, talent.locations.join(", "), talent.work_modes.join(" / "), talent.salary_min ? `from ${talent.salary_min.toLocaleString()} ${talent.salary_currency}` : null].filter(Boolean).join(" · ")}.
                Change these in <Link href="/dashboard/settings#preferences" className="text-wing hover:underline">Settings</Link>, then rebuild.
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6">
              <p className="font-semibold">Availability</p>
              <select className={`${inputClass} mt-3`} value={form.availability} onChange={(e) => set({ availability: e.target.value as TalentEdit["availability"] })}>
                {AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </section>
            <section className="rounded-3xl bg-white p-6">
              <p className="font-semibold">Hide from these companies</p>
              <p className="mt-1 text-xs text-muted">Recruiting teams with these names never see your profile. Add your current employer and anyone else.</p>
              <div className="mt-3">
                <ChipInput value={form.hidden_companies} onChange={(v) => set({ hidden_companies: v })} placeholder="Company name" max={20} />
              </div>
            </section>
            <div className="flex flex-col gap-2">
              <Button onClick={() => act(() => saveTalentProfile(form), () => setSaved(true))} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null} {saved ? "Saved" : "Save changes"}
              </Button>
              <Button variant="ghost" onClick={() => confirm("Rebuild from your latest resume? Your edits will be replaced.") && act(buildTalentProfile)} disabled={pending}>
                <RefreshCw className="size-4" /> Rebuild from my resume
              </Button>
              <button
                onClick={() => confirm("Delete your talent profile? Recruiters won't be able to find you.") && act(deleteTalentProfile)}
                className="inline-flex items-center justify-center gap-1.5 py-2 text-xs text-muted hover:text-red-600"
              >
                <Trash2 className="size-3.5" /> Delete profile
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
