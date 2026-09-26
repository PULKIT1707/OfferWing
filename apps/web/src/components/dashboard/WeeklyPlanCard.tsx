"use client";

import { ArrowRight, Compass, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { planMyWeek } from "@/app/dashboard/coach-actions";
import { AREA_PATH, type WeeklyPlan } from "@/lib/agents/coach";

export function WeeklyPlanCard({ plan }: { plan: WeeklyPlan | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = () => {
    setError(undefined);
    start(async () => {
      const r = await planMyWeek();
      if (r.error) setError(r.error);
      router.refresh();
    });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-wing/40 blur-[80px]" />
      <div className="relative flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Compass className="size-5 text-wing-soft" /> This week</h2>
        {plan && (
          <button onClick={run} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20 disabled:opacity-60">
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Replan
          </button>
        )}
      </div>
      {error && <p className="relative mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      {!plan ? (
        <div className="relative">
          <p className="mt-2 text-sm text-white/65">Your coach looks at your pipeline, network and interviews and tells you what matters most this week.</p>
          <button onClick={run} disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-wing px-4 py-2.5 text-sm font-medium hover:bg-wing-soft disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Compass className="size-4" />} {pending ? "Planning…" : "Plan my week"}
          </button>
        </div>
      ) : (
        <div className="relative">
          <p className="mt-2 text-sm text-white/85">{plan.focus}</p>
          <ol className="mt-4 space-y-2">
            {plan.priorities.map((p, i) => (
              <li key={p.title}>
                <Link href={AREA_PATH[p.area]} className="flex gap-3 rounded-2xl bg-white/5 p-3 hover:bg-white/10">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-wing text-xs font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-white/55">{p.why} · ~{p.minutes} min</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-white/40" />
                </Link>
              </li>
            ))}
          </ol>
          {plan.daily_rhythm.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Every day</p>
              <ul className="mt-1 space-y-1 text-sm text-white/80">{plan.daily_rhythm.map((d) => <li key={d}>• {d}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 rounded-xl bg-white/5 p-3 text-xs text-white/70"><span className="font-semibold text-white">Watch out: </span>{plan.watch_out}</p>
        </div>
      )}
    </section>
  );
}
