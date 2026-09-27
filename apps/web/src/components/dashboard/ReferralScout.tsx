"use client";

import { Check, ExternalLink, FileArchive, FileText, Loader2, RefreshCw, Search, Send, Sparkles, Trash2, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markDraftSent } from "@/app/dashboard/outreach/actions";
import { addConnectionToList, deleteImportedConnections, draftReferralAsk, searchConnections, startConnectionImport } from "@/app/dashboard/network/scout-actions";
import { createReferralPacket } from "@/app/dashboard/packets/actions";
import type { Connection, ReferralDraft, ScoredConnection } from "@/lib/agents/referral-scout";
import { CopyButton } from "./CopyButton";
import { Button, Modal } from "./ui";

export type ScoutTarget = { company: string; jobs: { id: string; title: string }[]; people: ScoredConnection[] };
export type ScoutState = {
  hasExport: boolean;
  lastImport: { status: "running" | "complete" | "failed"; error: string | null; created_at: string; completed_at: string | null; stats: { connections: number } | null; running: boolean } | null;
  lastComplete: { completed_at: string; connections: number } | null;
  targets: ScoutTarget[];
  onList: string[];
};

function Polling() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

const scoreStyle = (n: number) => (n >= 70 ? "bg-emerald-100 text-emerald-800" : n >= 40 ? "bg-wing/10 text-wing" : "bg-card text-muted");

function PersonRow({ p, onList, onDraft, onAdd }: { p: Connection & { score?: number; reasons?: string[] }; onList: boolean; onDraft: () => void; onAdd: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{p.full_name}</span>
          {p.score != null && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreStyle(p.score)}`}>{p.score}</span>}
          {p.profile_url && (
            <a href={p.profile_url} target="_blank" rel="noreferrer" aria-label={`Open ${p.full_name}'s LinkedIn`} className="text-muted hover:text-wing">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </p>
        <p className="truncate text-xs text-muted">{[p.position, p.company].filter(Boolean).join(" · ")}</p>
        {p.reasons && p.reasons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.reasons.map((r) => <span key={r} className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">{r}</span>)}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {onList ? (
          <span className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-emerald-700"><Check className="size-3.5" /> On your list</span>
        ) : (
          <Button variant="ghost" className="px-3 py-2 text-xs" onClick={onAdd}><UserPlus className="size-3.5" /> Add</Button>
        )}
        <Button className="px-3 py-2 text-xs" onClick={onDraft}><Sparkles className="size-3.5" /> Draft ask</Button>
      </div>
    </div>
  );
}

function DraftModal({ person, jobs, onClose }: { person: Connection; jobs: { id: string; title: string }[]; onClose: () => void }) {
  const [jobId, setJobId] = useState<string | null>(jobs[0]?.id ?? null);
  const [draft, setDraft] = useState<ReferralDraft>();
  const [draftId, setDraftId] = useState<string>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const generate = () =>
    start(async () => {
      setError(undefined);
      const r = await draftReferralAsk(person.id, jobId);
      if (r.error) setError(r.error);
      else {
        setDraft(r.draft);
        setDraftId(r.draftId);
      }
    });

  const packet = () =>
    start(async () => {
      if (!jobId) return;
      setError(undefined);
      const r = await createReferralPacket(jobId, person.id);
      if (r.error) setError(r.error);
      else if (r.id) router.push(`/dashboard/packets/${r.id}`);
    });

  const markSent = () =>
    start(async () => {
      if (!draftId) return;
      const r = await markDraftSent(draftId);
      if (r.error) setError(r.error);
      else {
        setSent(true);
        router.refresh();
      }
    });

  return (
    <Modal open onClose={onClose} title={`Referral ask · ${person.full_name}`}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="ref-job">For</label>
          <select id="ref-job" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" value={jobId ?? ""} onChange={(e) => { setJobId(e.target.value || null); setDraft(undefined); }}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            <option value="">General ask (any open role at {person.company})</option>
          </select>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {!draft ? (
          <Button onClick={generate} disabled={pending} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {pending ? "Writing…" : "Write the draft"}
          </Button>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Message</p><CopyButton text={draft.message} /></div>
              <p className="mt-2 whitespace-pre-line text-sm">{draft.message}</p>
            </div>
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Short version · {draft.short_version.length}/300</p><CopyButton text={draft.short_version} /></div>
              <p className="mt-2 text-sm">{draft.short_version}</p>
            </div>
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Follow-up in ~5 days</p><CopyButton text={draft.follow_up} /></div>
              <p className="mt-2 text-sm">{draft.follow_up}</p>
            </div>
            {draft.tips.length > 0 && <ul className="space-y-1 text-xs text-muted">{draft.tips.map((t) => <li key={t}>💡 {t}</li>)}</ul>}
            <div className="flex flex-col gap-2 sm:flex-row">
              {person.profile_url && (
                <a href={person.profile_url} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:border-wing hover:text-wing">
                  <ExternalLink className="size-4" /> Open their LinkedIn
                </a>
              )}
              {sent ? (
                <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700"><Check className="size-4" /> Marked as asked · follow-up in 5 days</span>
              ) : (
                <Button onClick={markSent} disabled={pending || !draftId} className="flex-1"><Send className="size-4" /> I sent it</Button>
              )}
            </div>
            {jobId && (
              <div className="rounded-2xl border border-dashed border-line p-4">
                <p className="text-sm font-medium">Make it easy for {person.full_name.split(" ")[0]} to say yes</p>
                <p className="mt-1 text-xs text-muted">A one-page link with why you fit, a blurb for their referral form and your tailored resume. Paste it into your message.</p>
                <Button variant="ghost" className="mt-3 w-full" disabled={pending} onClick={packet}><FileText className="size-4" /> Create a referral packet</Button>
              </div>
            )}
            <button onClick={generate} disabled={pending} className="w-full text-center text-xs text-muted hover:text-wing">Rewrite</button>
          </>
        )}
        <p className="text-xs text-muted">Offerwing never sends messages for you. Copy the draft, send it on LinkedIn yourself, then tap &ldquo;I sent it&rdquo;.</p>
      </div>
    </Modal>
  );
}

export function ReferralScout({ state }: { state: ScoutState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [drafting, setDrafting] = useState<{ person: Connection; jobs: { id: string; title: string }[] } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Connection[] | null>(null);
  const [onList, setOnList] = useState(new Set(state.onList));
  const imp = state.lastImport;
  const imported = !!state.lastComplete;
  const failedSinceImport = imp?.status === "failed" && !imp.running;

  const runImport = () =>
    start(async () => {
      setError(undefined);
      const r = await startConnectionImport();
      if (r.error) setError(r.error);
      router.refresh();
    });
  const add = (c: Connection, jobId: string | null) =>
    start(async () => {
      const r = await addConnectionToList(c.id, jobId);
      if (r.error) setError(r.error);
      else {
        setOnList((s) => new Set(s).add(c.id));
        router.refresh();
      }
    });
  const jobsFor = (company: string | null) => state.targets.find((t) => t.people.some((p) => p.company === company) || t.company === company)?.jobs ?? [];

  return (
    <section className="mb-10 overflow-hidden rounded-3xl bg-white">
      {imp?.running && <Polling />}
      <div className="flex flex-col gap-3 bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold"><Users className="size-5 text-wing-soft" /> Referral Scout</p>
          <p className="mt-1 text-sm text-white/60">
            {imported
              ? `${state.lastComplete!.connections.toLocaleString()} connections imported ${new Date(state.lastComplete!.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Ranked by who's most likely to refer you.`
              : "Finds the people you know at your target companies and ranks who's most likely to refer you."}
          </p>
        </div>
        {state.hasExport && imported && (
          <div className="flex items-center gap-2">
            {imp?.running && <Loader2 className="size-4 animate-spin text-wing-soft" aria-label="Re-importing" />}
            <button onClick={runImport} disabled={pending || imp?.running} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20 disabled:opacity-60">
              <RefreshCw className="size-3.5" /> Re-import
            </button>
            <button
              onClick={() => confirm("Delete all imported connections? People already on your referral list stay.") && start(async () => { const r = await deleteImportedConnections(); if (r.error) setError(r.error); router.refresh(); })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20"
              aria-label="Delete imported connections"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {imported && failedSinceImport && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The latest re-import failed: {imp!.error} Showing your previous import.</p>
        )}

        {!state.hasExport ? (
          <div className="text-center">
            <FileArchive className="mx-auto size-7 text-wing" />
            <p className="mt-3 font-medium">Upload your LinkedIn data export</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted">
              On LinkedIn: Settings → Data privacy → Get a copy of your data → choose the full archive (connections and messages). LinkedIn emails you a ZIP within about a day. Upload it as-is.
            </p>
            <p className="mx-auto mt-2 max-w-lg text-xs text-muted">We keep names, companies, positions and how often you&apos;ve messaged each person. Never email addresses or message text.</p>
            <Link href="/dashboard/settings#documents" className="mt-5 inline-block rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft">Upload the ZIP</Link>
          </div>
        ) : imp?.running && !imported ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted"><Loader2 className="size-4 animate-spin text-wing" /> Importing your connections…</p>
        ) : !imported ? (
          <div className="text-center">
            {failedSinceImport && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{imp!.error}</p>}
            <p className="font-medium">Your LinkedIn export is ready to import</p>
            <p className="mt-1 text-sm text-muted">Takes a few seconds. We never store email addresses or message text.</p>
            <Button onClick={runImport} disabled={pending} className="mt-5">{pending ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />} Import connections</Button>
          </div>
        ) : (
          <>
            {state.targets.length === 0 ? (
              <p className="text-sm text-muted">Add dream companies in Settings or save jobs to see who you know there.</p>
            ) : (
              <div className="space-y-6">
                {state.targets.map((t) => {
                  const open = expanded.includes(t.company);
                  const shown = open ? t.people : t.people.slice(0, 3);
                  return (
                    <div key={t.company}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{t.company}</p>
                        <span className="text-xs text-muted">{t.people.length} {t.people.length === 1 ? "person" : "people"} you know</span>
                        {t.jobs.map((j) => <span key={j.id} className="rounded-full bg-card px-2 py-0.5 text-xs text-muted">{j.title}</span>)}
                      </div>
                      {t.people.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">No 1st-degree connections here yet. Look for alumni or ex-colleagues on the company&apos;s People tab.</p>
                      ) : (
                        <div className="mt-1">
                          {shown.map((p) => (
                            <PersonRow key={p.id} p={p} onList={onList.has(p.id)} onAdd={() => add(p, t.jobs[0]?.id ?? null)} onDraft={() => setDrafting({ person: p, jobs: t.jobs })} />
                          ))}
                          {t.people.length > 3 && (
                            <button onClick={() => setExpanded((e) => (open ? e.filter((c) => c !== t.company) : [...e, t.company]))} className="mt-2 text-xs font-medium text-wing hover:underline">
                              {open ? "Show fewer" : `Show all ${t.people.length}`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 border-t border-line pt-6">
              <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
                <Search className="size-4 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && start(async () => setResults(await searchConnections(query)))}
                  placeholder="Search all your connections by name, company or role, then press Enter"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              {results && (
                <div className="mt-2">
                  {results.length === 0 ? (
                    <p className="py-3 text-sm text-muted">No matches.</p>
                  ) : (
                    results.map((p) => (
                      <PersonRow key={p.id} p={p} onList={onList.has(p.id)} onAdd={() => add(p, null)} onDraft={() => setDrafting({ person: p, jobs: jobsFor(p.company) })} />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {drafting && <DraftModal person={drafting.person} jobs={drafting.jobs} onClose={() => { setDrafting(null); router.refresh(); }} />}
    </section>
  );
}
