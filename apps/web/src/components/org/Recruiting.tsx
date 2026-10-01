"use client";

import { Inbox, Loader2, MapPin, Search, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestIntro, searchTalent, withdrawIntro, type IntroInput, type TalentResult } from "@/app/org/talent-actions";
import { Modal } from "@/components/dashboard/ui";
import { inputClass } from "@/components/onboarding/fields";
import { seniorityLabel } from "@/lib/onboarding";

export type OrgIntro = {
  id: string;
  public_id: string | null;
  role_title: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
  created_at: string;
  responded_at: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_linkedin: string | null;
  candidate_phone: string | null;
};

const AVAILABILITY: Record<string, string> = { now: "Available now", "2_weeks": "2 weeks' notice", "1_month": "1 month's notice", "3_months": "3 months' notice", exploring: "Open to the right role" };
const seniority = (s: string[]) => seniorityLabel(s, "") || null;

function IntroModal({ orgId, talent, onClose, onSent }: { orgId: string; talent: TalentResult; onClose: () => void; onSent: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<IntroInput>({ role_title: "", role_url: "", location: "", salary_range: "", message: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (patch: Partial<IntroInput>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Modal open onClose={onClose} title="Request an intro">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          start(async () => {
            const r = await requestIntro(orgId, talent.public_id, form);
            if (r.error) setError(r.error);
            else {
              onSent();
              router.refresh();
              onClose();
            }
          });
        }}
      >
        <p className="text-sm text-muted">{talent.headline}</p>
        <input className={inputClass} placeholder="Role title" value={form.role_title} onChange={(e) => set({ role_title: e.target.value })} required />
        <input className={inputClass} placeholder="Link to the job posting (optional)" value={form.role_url ?? ""} onChange={(e) => set({ role_url: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Location / remote" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          <input className={inputClass} placeholder="Salary range" value={form.salary_range} onChange={(e) => set({ salary_range: e.target.value })} />
        </div>
        <textarea
          className={`${inputClass} min-h-32`}
          placeholder="Why you're reaching out: what about their background fits, and what the role is. Specific messages get accepted far more often."
          value={form.message}
          onChange={(e) => set({ message: e.target.value })}
          required
        />
        <p className="text-xs text-muted">They see your team name, the role and your message. If they accept, you get their name and contact details.</p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send intro request
        </button>
      </form>
    </Modal>
  );
}

export function TalentSearch({ orgId }: { orgId: string }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [results, setResults] = useState<TalentResult[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState<TalentResult | null>(null);

  const search = () =>
    start(async () => {
      setError(undefined);
      const r = await searchTalent(orgId, query, location, remote);
      if (r.error) setError(r.error);
      else setResults(r.results ?? []);
    });

  return (
    <section className="rounded-3xl bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Search className="size-5 text-wing" /> Find candidates</h2>
      <p className="mt-1 text-sm text-muted">Everyone here chose to be discovered. Profiles are anonymous, and every highlight was checked against the candidate&apos;s own resume.</p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input className={inputClass} placeholder="Role or skills, e.g. product designer figma" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input className={`${inputClass} sm:max-w-48`} placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <label className="flex shrink-0 items-center gap-2 px-2 text-sm">
          <input type="checkbox" className="accent-[var(--wing)]" checked={remote} onChange={(e) => setRemote(e.target.checked)} /> Remote
        </label>
        <button disabled={pending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {results && (
        <div className="mt-6 space-y-3">
          {results.length === 0 && <p className="text-sm text-muted">No matching candidates yet. Try fewer words.</p>}
          {results.map((t) => (
            <article key={t.public_id} className="rounded-2xl border border-line p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{t.headline ?? t.roles.join(" / ")}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {[seniority(t.seniority), t.years_experience != null ? `${t.years_experience} yrs` : null, AVAILABILITY[t.availability]].filter(Boolean).join(" · ")}
                    {t.locations.length > 0 && (
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {t.locations.join(", ")}{t.open_to_relocate ? " · will relocate" : ""}</span>
                    )}
                  </p>
                </div>
                {t.intro_status ? (
                  <span className="w-fit shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted">Intro {t.intro_status}</span>
                ) : (
                  <button onClick={() => setAsking(t)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-wing px-3 py-2 text-xs font-medium text-white hover:bg-wing-soft">
                    <Send className="size-3.5" /> Request intro
                  </button>
                )}
              </div>
              {t.summary && <p className="mt-3 text-sm leading-relaxed">{t.summary}</p>}
              {t.highlights.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {t.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {h}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-1">
                {t.skills.slice(0, 14).map((s) => <span key={s} className="rounded-full bg-card px-2 py-0.5 text-xs text-muted">{s}</span>)}
              </div>
              <p className="mt-3 text-xs text-muted">
                {[t.work_modes.join(" / "), t.needs_sponsorship ? "Needs visa sponsorship" : null, t.salary_min ? `Looking for ${t.salary_min.toLocaleString()} ${t.salary_currency}+` : null].filter(Boolean).join(" · ")}
              </p>
            </article>
          ))}
        </div>
      )}
      {asking && (
        <IntroModal
          orgId={orgId}
          talent={asking}
          onClose={() => setAsking(null)}
          onSent={() => setResults((rs) => rs?.map((r) => (r.public_id === asking.public_id ? { ...r, intro_status: "pending" } : r)) ?? rs)}
        />
      )}
    </section>
  );
}

const STATUS_STYLE: Record<OrgIntro["status"], string> = {
  pending: "bg-amber-50 text-amber-800",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-card text-muted",
  withdrawn: "bg-card text-muted",
};

export function IntroList({ orgId, intros }: { orgId: string; intros: OrgIntro[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="rounded-3xl bg-white p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Inbox className="size-5 text-wing" /> Intro requests</h2>
      {intros.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No requests yet. When a candidate accepts, their name and contact details appear here.</p>
      ) : (
        <div className="mt-3">
          {intros.map((i) => (
            <div key={i.id} className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.status === "accepted" ? (i.candidate_name ?? "Candidate") : `Candidate ${i.public_id ?? ""}`} · {i.role_title}</p>
                {i.status === "accepted" ? (
                  <p className="text-xs text-muted">
                    {[i.candidate_email, i.candidate_phone].filter(Boolean).join(" · ")}
                    {i.candidate_linkedin && (
                      <>
                        {" · "}
                        <a href={i.candidate_linkedin} target="_blank" rel="noreferrer" className="text-wing hover:underline">LinkedIn</a>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Sent {new Date(i.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                {i.status === "pending" && (
                  <button disabled={pending} onClick={() => start(async () => { await withdrawIntro(orgId, i.id); router.refresh(); })} className="text-xs text-muted hover:text-red-600">
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
