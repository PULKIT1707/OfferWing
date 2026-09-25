"use client";

import { AlertTriangle, FileText, Gauge, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startProfileAudit } from "@/app/dashboard/profile/actions";
import type { AuditRun, ProfileAudit } from "@/lib/agents/profile-optimizer";
import { AuditResult } from "./AuditResult";
import { Button } from "./ui";

const STEPS = ["Reading your profile", "Comparing it with your target roles", "Scoring each section", "Drafting rewrites"];

function Running({ since }: { since: string }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(since).getTime());
  useEffect(() => {
    const tick = setInterval(() => setElapsed(Date.now() - new Date(since).getTime()), 1000);
    const poll = setInterval(() => router.refresh(), 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router, since]);
  const step = Math.min(STEPS.length - 1, Math.floor(elapsed / 15000));

  return (
    <div className="rounded-3xl bg-white p-8 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-wing" />
      <p className="mt-4 font-medium">{STEPS[step]}…</p>
      <p className="mt-1 text-sm text-muted">Audits usually take 30 to 90 seconds. You can leave this page; it keeps running.</p>
      <div className="mx-auto mt-5 flex max-w-xs gap-1.5">
        {STEPS.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-wing" : "bg-card"}`} />)}
      </div>
    </div>
  );
}

// `running` is computed on the server: a "running" row older than the stale limit counts as crashed.
export function AuditPanel({ run, running, hasDocument, aiMode }: { run: AuditRun | null; running: boolean; hasDocument: boolean; aiMode: "starter" | "private" | "cloud" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const trigger = () =>
    start(async () => {
      setError(undefined);
      const r = await startProfileAudit();
      if (r.error) setError(r.error);
      router.refresh();
    });

  const runButton = (label: string) => (
    <Button onClick={trigger} disabled={pending || running}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : run ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
      {label}
    </Button>
  );

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Gauge className="size-5 text-wing" /> LinkedIn profile audit
          </h2>
          <p className="mt-1 text-sm text-muted">The Profile Optimizer scores your profile against your target roles and drafts rewrites for you to approve.</p>
        </div>
        {hasDocument && run?.status === "complete" && runButton("Re-run audit")}
      </div>

      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {!hasDocument ? (
        <div className="rounded-3xl border border-dashed border-line bg-white p-8 text-center">
          <FileText className="mx-auto size-7 text-wing" />
          <p className="mt-3 font-medium">Upload your LinkedIn profile PDF or resume</p>
          <p className="mt-1 text-sm text-muted">On LinkedIn: open your profile → Resources (or More) → Save to PDF.</p>
          <Link href="/dashboard/settings#documents" className="mt-5 inline-block rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft">Upload a document</Link>
        </div>
      ) : running ? (
        <Running since={run!.created_at} />
      ) : run?.status === "complete" && run.result ? (
        <AuditResult run={run as AuditRun & { result: ProfileAudit }} />
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center">
          {run?.status === "failed" || run?.status === "running" ? (
            <>
              <AlertTriangle className="mx-auto size-7 text-amber-500" />
              <p className="mt-3 font-medium">The last audit didn&apos;t finish</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{run.error ?? "It took too long and was stopped."}</p>
            </>
          ) : (
            <>
              <Sparkles className="mx-auto size-7 text-wing" />
              <p className="mt-3 font-medium">Run your first audit</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                {aiMode === "starter" ? "Runs on Starter credits (2 audits a day)." : aiMode === "cloud" ? "Runs on your own AI key." : "Private mode needs the browser extension; switch to Starter or Always-on to run it here."}
              </p>
            </>
          )}
          <div className="mt-5">{runButton(run ? "Try again" : "Audit my profile")}</div>
        </div>
      )}
    </section>
  );
}
