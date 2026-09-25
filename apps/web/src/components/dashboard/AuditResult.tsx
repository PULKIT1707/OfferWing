"use client";

import { AlertCircle, ChevronDown, Lightbulb, Pin, Sparkles } from "lucide-react";
import { useState } from "react";
import type { AuditRun, ProfileAudit } from "@/lib/agents/profile-optimizer";
import { CopyButton } from "./CopyButton";

const SECTION_LABEL: Record<ProfileAudit["sections"][number]["section"], string> = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
  skills: "Skills",
  extras: "Featured & extras",
};
const STYLE_LABEL = { keyword: "Keyword-first", value: "Value proposition", proof: "Proof point" } as const;

const scoreColor = (n: number) => (n >= 80 ? "bg-emerald-500" : n >= 60 ? "bg-wing" : n >= 40 ? "bg-amber-500" : "bg-rose-500");

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionRow({ s }: { s: ProfileAudit["sections"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 py-3 text-left" aria-expanded={open}>
        <span className="w-36 shrink-0 text-sm font-medium">{SECTION_LABEL[s.section]}</span>
        <span className="h-2 flex-1 rounded-full bg-card">
          <span className={`block h-full rounded-full ${scoreColor(s.score)}`} style={{ width: `${s.score}%` }} />
        </span>
        <span className="w-8 text-right text-sm font-semibold">{s.score}</span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="grid gap-4 pb-5 sm:grid-cols-2">
          {s.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Working</p>
              <ul className="mt-2 space-y-1.5 text-sm">{s.strengths.map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          )}
          {s.issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Fix</p>
              <ul className="mt-2 space-y-1.5 text-sm">{s.issues.map((x) => <li key={x}>• {x}</li>)}</ul>
            </div>
          )}
          <p className="rounded-2xl bg-wing/5 p-4 text-sm sm:col-span-2">
            <span className="font-medium text-wing">Top change: </span>
            {s.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

export function AuditResult({ run }: { run: AuditRun & { result: ProfileAudit } }) {
  const a = run.result;
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-wing/40 blur-[100px]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="grid size-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--wing) 0 ${a.overall_score}%, rgba(255,255,255,.12) ${a.overall_score}% 100%)` }}>
            <div className="grid size-[5.75rem] place-items-center rounded-full bg-ink text-3xl font-semibold">{a.overall_score}</div>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Sparkles className="size-4 text-wing-soft" /> LinkedIn profile audit
            </p>
            <p className="mt-2 text-white/90">{a.summary}</p>
            <p className="mt-3 text-xs text-white/45">
              From {run.source_kind === "linkedin_pdf" ? "your LinkedIn PDF" : "your resume"} ({run.source_file_name}) · {run.model} ·{" "}
              {new Date(run.completed_at ?? run.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Section scores">
          {a.sections.map((s) => <SectionRow key={s.section} s={s} />)}
        </Block>
        <Block title="Quick wins">
          <ul className="space-y-3">
            {a.quick_wins.map((w) => (
              <li key={w} className="flex gap-3 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-wing" /> {w}
              </li>
            ))}
          </ul>
          {a.needs_input.length > 0 && (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertCircle className="size-4" /> Fill in the [placeholders] with real facts
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900/80">{a.needs_input.map((n) => <li key={n}>• {n}</li>)}</ul>
            </div>
          )}
        </Block>
      </div>

      <Block title="Headline options">
        <div className="space-y-3">
          {a.headline_variants.map((h) => (
            <div key={h.text} className="rounded-2xl bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-wing">{STYLE_LABEL[h.style]}</p>
                <CopyButton text={h.text} />
              </div>
              <p className="mt-2 text-sm">{h.text}</p>
              <p className="mt-2 text-xs text-muted">{h.text.length}/220 characters</p>
            </div>
          ))}
        </div>
      </Block>

      <Block title="About section draft" action={<CopyButton text={a.about_draft} />}>
        <p className="whitespace-pre-line rounded-2xl bg-card p-4 text-sm leading-relaxed">{a.about_draft}</p>
        <p className="mt-2 text-xs text-muted">{a.about_draft.length}/2,600 characters</p>
      </Block>

      {a.experience_rewrites.length > 0 && (
        <Block title="Experience rewrites">
          <div className="space-y-4">
            {a.experience_rewrites.map((e) => {
              const text = e.bullets.map((b) => `• ${b}`).join("\n");
              return (
                <div key={`${e.role}-${e.company}`} className="rounded-2xl bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      {e.role} <span className="text-muted">· {e.company}</span>
                    </p>
                    <CopyButton text={text} />
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">{e.bullets.map((b) => <li key={b}>• {b}</li>)}</ul>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Skills">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pin these top 5</p>
          <ol className="mt-3 space-y-2">
            {a.top_skills.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-wing/10 text-xs font-semibold text-wing">{i + 1}</span>
                {s}
                {i === 0 && <Pin className="size-3.5 text-muted" />}
              </li>
            ))}
          </ol>
          {a.skills_to_add.length > 0 && (
            <>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Add these</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.skills_to_add.map((s) => <span key={s} className="rounded-full bg-card px-3 py-1 text-sm">{s}</span>)}
              </div>
            </>
          )}
        </Block>
        <Block title="Keywords recruiters search for">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Missing</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {a.keywords_missing.length ? a.keywords_missing.map((k) => <span key={k} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-800">{k}</span>) : <span className="text-sm text-muted">None, nice work.</span>}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-emerald-700">Already on your profile</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {a.keywords_present.map((k) => <span key={k} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">{k}</span>)}
          </div>
        </Block>
      </div>

      <p className="text-center text-xs text-muted">Drafts are suggestions based only on your document. Review them, then paste the ones you like into LinkedIn yourself.</p>
    </div>
  );
}
