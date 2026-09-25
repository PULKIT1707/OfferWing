"use client";

import { AlertTriangle, ArrowLeft, Download, FileText, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startApplicationKit } from "@/app/dashboard/jobs/kit-actions";
import type { ApplicationKit } from "@/lib/agents/application-tailor";
import type { Verification } from "@/lib/agents/truthfulness";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui";

export type KitRun = {
  id: string;
  status: "running" | "complete" | "failed";
  model: string;
  result: ApplicationKit | null;
  verification: Verification | null;
  error: string | null;
  created_at: string;
};

function Polling() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="rounded-3xl bg-white p-10 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-wing" />
      <p className="mt-4 font-medium">Tailoring your resume, cover note and answers…</p>
      <p className="mt-1 text-sm text-muted">Usually 30 to 90 seconds. Every claim is then checked against your documents.</p>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function VerificationBanner({ v }: { v: Verification }) {
  const issues = v.flagged.length + v.unverified_skills.length;
  if (!issues) {
    return (
      <div className="flex items-start gap-3 rounded-3xl bg-emerald-50 p-5 text-emerald-900">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm">
          <span className="font-medium">Every item checked out.</span> All {v.checked} bullets, titles and numbers trace back to your documents. Still read it through before you send it.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-amber-50 p-5 text-amber-950">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-5" /> {issues} {issues === 1 ? "item needs" : "items need"} your review before you use this
      </p>
      <p className="mt-1 text-sm opacity-80">These couldn&apos;t be traced back to your resume or LinkedIn PDF. Fix or remove anything that isn&apos;t accurate.</p>
      <ul className="mt-3 space-y-2 text-sm">
        {v.flagged.map((f, i) => (
          <li key={i} className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-amber-800">{f.where}</p>
            <p className="mt-0.5">&ldquo;{f.text}&rdquo;</p>
            <p className="mt-1 text-xs font-medium text-amber-800">{f.reasons.join(" · ")}</p>
          </li>
        ))}
        {v.unverified_skills.length > 0 && (
          <li className="rounded-2xl bg-white/70 p-3">
            <p className="text-xs text-amber-800">Skills</p>
            <p className="mt-0.5">{v.unverified_skills.join(", ")}</p>
            <p className="mt-1 text-xs font-medium text-amber-800">Not mentioned in your documents</p>
          </li>
        )}
      </ul>
    </div>
  );
}

function ResumePreview({ kit, v }: { kit: ApplicationKit; v: Verification | null }) {
  const r = kit.resume;
  const flaggedTexts = new Set(v?.flagged.map((f) => f.text));
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-8 font-[Calibri,Arial,sans-serif] text-[13px] leading-relaxed sm:px-10">
      <p className="text-center text-2xl font-bold">{r.name}</p>
      <p className="text-center">{r.headline}</p>
      {r.contact_line && <p className="text-center text-xs text-muted">{r.contact_line}</p>}
      <p className="mt-5 border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-wider">SUMMARY</p>
      <p className="mt-2">{r.summary}</p>
      {r.experience.length > 0 && <p className="mt-5 border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-wider">EXPERIENCE</p>}
      {r.experience.map((role) => (
        <div key={`${role.title}-${role.company}`} className="mt-3">
          <p className="flex justify-between gap-4">
            <span>
              <span className="font-bold">{role.title}</span> · {role.company}
            </span>
            <span className="shrink-0 text-muted">{role.dates}</span>
          </p>
          {role.location && <p className="text-xs italic text-muted">{role.location}</p>}
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {role.bullets.map((b) => (
              <li key={b.text} className={flaggedTexts.has(b.text) ? "rounded bg-amber-100" : ""} title={flaggedTexts.has(b.text) ? "Needs your review" : undefined}>
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {r.skills.length > 0 && (
        <>
          <p className="mt-5 border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-wider">SKILLS</p>
          <p className="mt-2">{r.skills.join(" · ")}</p>
        </>
      )}
      {r.education.length > 0 && <p className="mt-5 border-b border-zinc-300 pb-0.5 text-xs font-bold tracking-wider">EDUCATION</p>}
      {r.education.map((e) => (
        <p key={`${e.degree}-${e.school}`} className="mt-2 flex justify-between gap-4">
          <span>
            <span className="font-bold">{e.degree}</span>
            {e.school ? ` · ${e.school}` : ""}
          </span>
          <span className="shrink-0 text-muted">{e.dates}</span>
        </p>
      ))}
      {r.extra_sections.filter((s) => s.items.length).map((s) => (
        <div key={s.heading}>
          <p className="mt-5 border-b border-zinc-300 pb-0.5 text-xs font-bold uppercase tracking-wider">{s.heading}</p>
          <ul className="mt-2 list-disc pl-5">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

export function KitView({ job, run, running }: { job: { id: string; title: string; company: string; hasDescription: boolean }; run: KitRun | null; running: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const kit = run?.status === "complete" ? run.result : null;

  const generate = () =>
    start(async () => {
      setError(undefined);
      const r = await startApplicationKit(job.id);
      if (r.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Jobs pipeline
      </Link>
      <div className="mt-3 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-wing">Application kit</p>
          <h1 className="headline mt-1 text-3xl font-semibold sm:text-4xl">{job.title}</h1>
          <p className="mt-1 text-muted">{job.company}</p>
        </div>
        {kit && !running && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={generate} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Re-tailor
            </Button>
            <a href={`/api/kits/${run!.id}/resume`} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft">
              <Download className="size-4" /> Resume (.docx)
            </a>
          </div>
        )}
      </div>

      {error && <p className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}</p>}

      {!job.hasDescription ? (
        <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center">
          <FileText className="mx-auto size-7 text-wing" />
          <p className="mt-3 font-medium">Add the job description first</p>
          <p className="mt-1 text-sm text-muted">Open the job in your pipeline and paste the posting.</p>
        </div>
      ) : running ? (
        <Polling />
      ) : kit ? (
        <div className="space-y-6">
          {run?.verification && <VerificationBanner v={run.verification} />}
          <Section title="Tailored resume" action={<span className="text-xs text-muted">{run!.model}</span>}>
            <ResumePreview kit={kit} v={run!.verification} />
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Cover note" action={<CopyButton text={kit.cover_note} />}>
              <p className="whitespace-pre-line text-sm leading-relaxed">{kit.cover_note}</p>
            </Section>
            <Section title="Note to the hiring manager" action={<CopyButton text={kit.connection_note} />}>
              <p className="text-sm leading-relaxed">{kit.connection_note}</p>
              <p className="mt-2 text-xs text-muted">{kit.connection_note.length}/300 characters · for a LinkedIn connection request</p>
            </Section>
          </div>
          {kit.screening_answers.length > 0 && (
            <Section title="Screening answers">
              <div className="space-y-3">
                {kit.screening_answers.map((a) => (
                  <div key={a.question} className="rounded-2xl bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{a.question}</p>
                      <CopyButton text={a.answer} />
                    </div>
                    <p className="mt-2 text-sm">{a.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            {kit.changes_made.length > 0 && (
              <Section title="What we tailored">
                <ul className="space-y-1.5 text-sm">{kit.changes_made.map((c) => <li key={c}>• {c}</li>)}</ul>
              </Section>
            )}
            {kit.needs_input.length > 0 && (
              <Section title="Fill in the [placeholders]">
                <ul className="space-y-1.5 text-sm">{kit.needs_input.map((n) => <li key={n}>• {n}</li>)}</ul>
              </Section>
            )}
          </div>
          <p className="text-center text-xs text-muted">Offerwing never submits applications for you. Review everything, then apply yourself.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-10 text-center">
          {run?.status === "failed" || run?.status === "running" ? (
            <>
              <AlertTriangle className="mx-auto size-7 text-amber-500" />
              <p className="mt-3 font-medium">The last attempt didn&apos;t finish</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{run.error ?? "It took too long and was stopped."}</p>
            </>
          ) : (
            <>
              <Sparkles className="mx-auto size-7 text-wing" />
              <p className="mt-3 font-medium">Tailor your application</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                A resume, cover note, hiring-manager note and screening answers written for this job, using only your real experience.
              </p>
            </>
          )}
          <div className="mt-5">
            <Button onClick={generate} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {run ? "Try again" : "Tailor my application"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
