import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CHANNELS, JOB_COLUMNS, labelOf, type Job } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Insights · Offerwing" };

const ORDER = ["saved", "applied", "screen", "interview", "offer"] as const;
// How far a job got. Closed jobs count as reaching "applied" if they were ever applied to.
const reached = (j: Job) => (j.stage === "rejected" || j.stage === "withdrawn" ? (j.applied_at ? 1 : 0) : ORDER.indexOf(j.stage as (typeof ORDER)[number]));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function InsightsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("jobs").select(JOB_COLUMNS);
  const jobs = (data ?? []) as Job[];
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
        </div>
      )}
    </div>
  );
}
