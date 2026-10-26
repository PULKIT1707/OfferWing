"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Loader2, RefreshCw, ShieldAlert, Sparkles, Target } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { startJobMatches } from "@/app/dashboard/jobs/actions";
import type { JobMatch, MatchRun } from "@/lib/agents/job-match";
import type { Job } from "@/lib/dashboard";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui";

export const VERDICT_STYLE: Record<JobMatch["verdict"], { label: string; className: string }> = {
  strong: { label: "Strong fit", className: "bg-emerald-100 text-emerald-800" },
  good: { label: "Good fit", className: "bg-offer text-ink" },
  stretch: { label: "Stretch", className: "bg-amber-100 text-amber-800" },
  weak: { label: "Weak fit", className: "bg-rose-100 text-rose-700" },
};

const LEGITIMACY: Record<NonNullable<JobMatch["legitimacy"]>, { label: string; className: string }> = {
  high_confidence: { label: "Looks like a real, open role", className: "bg-emerald-50 text-emerald-800" },
  proceed_with_caution: { label: "Mixed signals about this posting", className: "bg-amber-50 text-amber-900" },
  suspicious: { label: "This posting looks suspicious. Check it before you apply", className: "bg-rose-50 text-rose-900" },
};

const CONFIDENCE: Record<NonNullable<JobMatch["confidence"]>, string> = {
  high: "High confidence: every part of this score is backed by the posting or your documents.",
  medium: "Medium confidence: some of this score rests on details the posting or your documents don't state.",
  low: "Low confidence: key evidence is missing, so treat this score as a rough guess.",
};

const CHANNEL_LABEL: Record<JobMatch["recommended_channel"], string> = {
  referral: "Ask for a referral first",
  hiring_manager: "Message the hiring manager",
  easy_apply: "Easy Apply",
  company_site: "Apply on the company site",
};

function List({ title, items, tone }: { title: string; items: string[]; tone: "rose" | "amber" }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-2xl p-4 ${tone === "rose" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" /> {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm opacity-90">{items.map((i) => <li key={i}>• {i}</li>)}</ul>
    </div>
  );
}

function MatchResult({ m }: { m: JobMatch }) {
  const verdict = VERDICT_STYLE[m.verdict];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--wing) 0 ${m.fit_score}%, var(--card) ${m.fit_score}% 100%)` }}>
          <div className="grid size-[3.25rem] place-items-center rounded-full bg-white text-lg font-semibold">{m.fit_score}</div>
        </div>
        <div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${verdict.className}`}>{verdict.label}</span>
          <p className="mt-1.5 text-sm">{m.summary}</p>
        </div>
      </div>

      {m.confidence && <p className="text-xs text-muted">{CONFIDENCE[m.confidence]}</p>}
      {m.verdict === "weak" && (
        <p className="rounded-2xl bg-card p-4 text-sm">
          We&apos;d skip this one. A few well-matched applications get more interviews than many weak ones. Apply only if you have a specific reason this score misses.
        </p>
      )}
      {m.legitimacy && (
        <p className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm ${LEGITIMACY[m.legitimacy].className}`}>
          <ShieldAlert className="size-4 shrink-0" /> {LEGITIMACY[m.legitimacy].label}
        </p>
      )}
      <div className="rounded-2xl bg-wing/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-wing">
          <Target className="size-4" /> {CHANNEL_LABEL[m.recommended_channel]}
        </p>
        <p className="mt-1 text-muted">{m.channel_reason}</p>
      </div>

      <List title="Conflicts with your preferences" items={m.preference_conflicts} tone="rose" />
      <List title="Red flags in the posting" items={m.red_flags} tone="amber" />
      <List title="Text in the posting that tried to instruct the AI (ignored)" items={m.injected_instructions ?? []} tone="rose" />
      {(m.open_questions?.length ?? 0) > 0 && (
        <div className="rounded-2xl bg-card p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <HelpCircle className="size-4" /> Worth checking before you apply
          </p>
          <ul className="mt-2 space-y-1 text-muted">{m.open_questions!.map((q) => <li key={q}>• {q}</li>)}</ul>
        </div>
      )}

      {m.matched.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">You match</p>
          <ul className="mt-2 space-y-2">
            {m.matched.map((x) => (
              <li key={x.requirement} className="flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="font-medium">{x.requirement}</span>
                  <span className="block text-xs text-muted">{x.evidence}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Gaps</p>
          <ul className="mt-2 space-y-2">
            {m.gaps.map((g) => (
              <li key={g.requirement} className="flex gap-2 text-sm">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-rose-500" />
                <span>
                  <span className="font-medium">{g.requirement}</span>
                  <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">{g.importance === "must_have" ? "Must-have" : "Nice to have"}</span>
                  <span className="block text-xs text-muted">{g.how_to_address}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {m.keywords_to_mirror.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mirror these phrases (where true)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{m.keywords_to_mirror.map((k) => <span key={k} className="rounded-full bg-card px-2.5 py-1 text-xs">{k}</span>)}</div>
        </div>
      )}

      {m.talking_points.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lead with</p>
            <CopyButton text={m.talking_points.map((t) => `• ${t}`).join("\n")} />
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">{m.talking_points.map((t) => <li key={t}>• {t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// `run` is owned by the board (loaded when the job opens); this panel polls via `onRefresh` while scoring.
export function JobMatchPanel({ job, run, onRefresh }: { job: Job; run: MatchRun | null | undefined; onRefresh: () => Promise<void> }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const running = run?.status === "running";

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void onRefresh(), 3000);
    return () => clearInterval(t);
  }, [running, onRefresh]);

  const score = () =>
    start(async () => {
      setError(undefined);
      const r = await startJobMatches([job.id]);
      if (r.error || r.skipped.length) setError(r.error ?? r.skipped[0].reason);
      await onRefresh();
    });

  // A newer description than the last score means the result is out of date.
  const outdated = run?.status === "complete" && job.fit_score == null;

  return (
    <section className="mb-6 rounded-3xl border border-line p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-wing" /> Fit analysis
        </p>
        {job.description && run !== undefined && !running && (
          <Button variant="ghost" onClick={score} disabled={pending} className="py-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {run ? "Re-score" : "Score fit"}
          </Button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!job.description ? (
        <p className="text-sm text-muted">Paste the job description below and save to get a fit score, gaps and the best way to apply.</p>
      ) : run === undefined ? (
        <Loader2 className="size-5 animate-spin text-muted" />
      ) : running ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin text-wing" /> Comparing this job with your background…
        </p>
      ) : run?.status === "failed" ? (
        <p className="text-sm text-red-600">{run.error}</p>
      ) : run?.status === "complete" && run.result ? (
        <>
          {outdated && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The description changed since this score. Re-score for an up-to-date result.</p>}
          <MatchResult m={run.result} />
        </>
      ) : (
        <p className="text-sm text-muted">Not scored yet.</p>
      )}
    </section>
  );
}
