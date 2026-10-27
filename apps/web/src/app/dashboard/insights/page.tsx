import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { calibrate, MIN_APPLIED } from "@/lib/calibration";
import { CHANNELS, JOB_COLUMNS, labelOf, type Job } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Insights · Offerwing" };

const ORDER = ["saved", "applied", "screen", "interview", "offer"] as const;
// How far a job got. Closed jobs count as reaching "applied" if they were ever applied to.
const reached = (j: Job) => (j.stage === "rejected" || j.stage === "withdrawn" ? (j.applied_at ? 1 : 0) : ORDER.indexOf(j.stage as (typeof ORDER)[number]));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function InsightsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("jobs").select(JOB_COLUMNS);
  const jobs = ((data ?? []) as Job[]).filter((j) => j.stage !== "discovered" && j.stage !== "dismissed");
  const applied = jobs.filter((j) => reached(j) >= 1);

  const funnel = [
    { label: "Tracked", n: jobs.length },
    { label: "Applied", n: applied.length },
    { label: "Screen", n: jobs.filter((j) => reached(j) >= 2).length },
    { label: "Interview", n: jobs.filter((j) => reached(j) >= 3).length },
    { label: "Offer", n: jobs.filter((j) => reached(j) >= 4).length },
  ];
  const max = Math.max(1, funnel[0].n);

  const byChannel = CHANNELS.map(([id]) => {
    const js = applied.filter((j) => j.channel === id);
    return { id, total: js.length, responded: js.filter((j) => reached(j) >= 2).length };
  }).filter((c) => c.total > 0);
  const untagged = applied.filter((j) => !j.channel).length;
  const cal = calibrate(jobs.map((j) => ({ fit_score: j.fit_score, reached: reached(j) })));
  const BAND_LABEL = { strong: "Strong fit", good: "Good fit", stretch: "Stretch", weak: "Weak fit" } as const;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="headline text-3xl font-semibold sm:text-4xl">Insights</h1>
      <p className="mt-2 text-muted">What&apos;s working in your search, based on the jobs you track.</p>

      {applied.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-wing/10 text-wing"><BarChart3 className="size-6" /></div>
          <p className="mt-4 font-medium">Insights appear once you&apos;ve applied</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Move jobs to Applied and record how you applied. You&apos;ll see which channels get responses.</p>
          <Link href="/dashboard/jobs" className="mt-5 rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft">Open pipeline</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-semibold">Funnel</h2>
            <div className="mt-5 space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{f.label}</span>
                    <span className="text-muted">
                      {f.n}
                      {i > 1 && funnel[1].n > 0 && ` · ${pct(f.n, funnel[1].n)}% of applied`}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-card">
                    <div className="h-full rounded-full bg-wing" style={{ width: `${(f.n / max) * 100}%`, opacity: 1 - i * 0.12 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-semibold">Response rate by channel</h2>
            <p className="mt-1 text-sm text-muted">Share of applications that reached a screen or further.</p>
            {byChannel.length === 0 ? (
              <p className="mt-5 text-sm text-muted">Record &ldquo;How you applied&rdquo; on your jobs to compare channels.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {byChannel.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{labelOf(CHANNELS, c.id)}</span>
                      <span className="text-muted">{pct(c.responded, c.total)}% · {c.responded}/{c.total}</span>
                    </div>
                    <div className="h-3 rounded-full bg-card">
                      <div className="h-full rounded-full bg-wing" style={{ width: `${pct(c.responded, c.total)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {untagged > 0 && <p className="mt-5 text-xs text-muted">{untagged} applied {untagged === 1 ? "job has" : "jobs have"} no channel recorded.</p>}
          </section>
          <section className="rounded-3xl bg-white p-6 lg:col-span-2">
            <h2 className="font-semibold">Does the fit score predict results?</h2>
            <p className="mt-1 text-sm text-muted">Applications by fit score, and how many reached a screen or an interview. This only reports; it never changes how jobs are scored.</p>
            {!cal.enough ? (
              <p className="mt-5 text-sm text-muted">
                Too early to tell: {cal.scored} scored {cal.scored === 1 ? "application" : "applications"} so far. Check back after {MIN_APPLIED}.
              </p>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {cal.bands.map((b) => (
                    <div key={b.verdict} className="rounded-2xl bg-card p-4">
                      <p className="text-sm font-medium">{BAND_LABEL[b.verdict]}</p>
                      <p className="text-xs text-muted">Score {b.min}+ · {b.applied} applied</p>
                      <p className="mt-3 text-2xl font-semibold">{b.applied ? `${pct(b.responded, b.applied)}%` : "–"}</p>
                      <p className="text-xs text-muted">responses · {b.applied ? `${pct(b.interviewed, b.applied)}%` : "–"} interviews</p>
                    </div>
                  ))}
                </div>
                {cal.inverted && (
                  <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {BAND_LABEL[cal.inverted.better]} applications are getting more responses than {BAND_LABEL[cal.inverted.worse].toLowerCase()} ones. Your target roles or preferences may not match the jobs that are working for you; it&apos;s worth reviewing them in Settings.
                  </p>
                )}
              </>
            )}
            {cal.unscored > 0 && <p className="mt-4 text-xs text-muted">{cal.unscored} applied {cal.unscored === 1 ? "job has" : "jobs have"} no fit score and {cal.unscored === 1 ? "isn't" : "aren't"} counted.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
