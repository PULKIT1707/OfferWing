"use client";

import { AlertTriangle, ArrowLeft, BookOpen, ExternalLink, Loader2, MessageCircleQuestion, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { practiceAnswer, startPrep } from "@/app/dashboard/interviews/actions";
import { ROUNDS, type Feedback, type PrepPack, type Round } from "@/lib/agents/interviews";
import { inputClass } from "@/components/onboarding/fields";
import { CopyButton } from "./CopyButton";
import { Button, Card, label } from "./ui";

export type PrepRun = {
  id: string;
  status: "running" | "complete" | "failed";
  round: Round;
  interviewer_notes: string | null;
  researched: boolean;
  model: string;
  result: (PrepPack & { sources?: { title: string; url: string }[] }) | null;
  error: string | null;
  created_at: string;
};
export type PracticeRow = { id: string; question: string; answer: string; feedback: Feedback; created_at: string };

const CATEGORY: Record<PrepPack["likely_questions"][number]["category"], string> = { motivation: "Motivation", behavioral: "Behavioral", role: "Role", technical: "Technical", company: "Company" };

function Polling() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

function Practice({ jobId, questions, history }: { jobId: string; questions: string[]; history: PracticeRow[] }) {
  const [question, setQuestion] = useState(questions[0] ?? "Tell me about yourself.");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold"><MessageCircleQuestion className="size-4 text-wing" /> Practice</h2>
      <p className="mt-1 text-sm text-muted">Type your answer as you&apos;d say it. You&apos;ll get candid feedback and a stronger version built only from what you wrote.</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className={label} htmlFor="p-q">Question</label>
          <select id="p-q" className={inputClass} value={questions.includes(question) ? question : ""} onChange={(e) => { setQuestion(e.target.value || question); setFeedback(undefined); }}>
            {questions.map((q) => <option key={q} value={q}>{q}</option>)}
            <option value="">Custom question…</option>
          </select>
          {!questions.includes(question) && <input className={`${inputClass} mt-2`} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Custom question" />}
        </div>
        <div>
          <label className={label} htmlFor="p-a">Your answer</label>
          <textarea id="p-a" rows={6} className={inputClass} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Situation, what you did, and the result…" />
          <p className="mt-1 text-xs text-muted">{answer.trim().split(/\s+/).filter(Boolean).length} words · aim for about 150–250 (90–120 seconds spoken)</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <Button disabled={pending || answer.trim().length < 20} onClick={() => start(async () => { setError(undefined); const r = await practiceAnswer(jobId, question, answer); if (r.error) setError(r.error); else setFeedback(r.feedback); })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Get feedback
        </Button>
      </div>
      {feedback && (
        <div className="mt-5 space-y-3 rounded-2xl bg-card p-4 text-sm">
          <p className="text-lg font-semibold">{feedback.score}/10</p>
          <p>{feedback.structure}</p>
          {feedback.strengths.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Working</p><ul className="mt-1 list-disc pl-5">{feedback.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          {feedback.improvements.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Improve</p><ul className="mt-1 list-disc pl-5">{feedback.improvements.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <div className="rounded-xl bg-white p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Stronger version</p><CopyButton text={feedback.stronger_answer} /></div>
            <p className="mt-2 whitespace-pre-line">{feedback.stronger_answer}</p>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-medium text-wing">Past practice ({history.length})</summary>
          <ul className="mt-2 divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <p className="font-medium">{h.question} <span className="text-muted">· {h.feedback.score}/10</span></p>
                <p className="mt-0.5 line-clamp-2 text-muted">{h.answer}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function PrepView({ job, run, running, history, storyCount }: { job: { id: string; title: string; company: string; hasDescription: boolean }; run: PrepRun | null; running: boolean; history: PracticeRow[]; storyCount: number }) {
  const router = useRouter();
  const [round, setRound] = useState<Round>(run?.round ?? "hiring_manager");
  const [notes, setNotes] = useState(run?.interviewer_notes ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const pack = run?.status === "complete" ? run.result : null;

  const generate = () =>
    start(async () => {
      setError(undefined);
      const r = await startPrep(job.id, round, notes);
      if (r.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-4xl">
      {running && <Polling />}
      <Link href="/dashboard/interviews" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" /> Interviews & offers</Link>
      <p className="mt-3 text-sm font-medium text-wing">Interview prep</p>
      <h1 className="headline mt-1 text-3xl font-semibold sm:text-4xl">{job.title}</h1>
      <p className="mt-1 text-muted">{job.company}</p>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div>
            <label className={label} htmlFor="r-round">Round</label>
            <select id="r-round" className={inputClass} value={round} onChange={(e) => setRound(e.target.value as Round)}>
              {ROUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="r-notes">Interviewer (optional)</label>
            <input id="r-notes" className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Maya Chen, Design Director; ex-Figma; cares about systems thinking" />
          </div>
        </div>
        {!job.hasDescription && <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> This job has no description saved; the prep pack will be more generic.</p>}
        {storyCount === 0 && <p className="mt-2 flex items-center gap-2 text-xs text-muted"><BookOpen className="size-3.5" /> Tip: build your story bank first so questions get matched to your stories.</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <Button onClick={generate} disabled={pending || running}>
            {pending || running ? <Loader2 className="size-4 animate-spin" /> : pack ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
            {running ? "Preparing…" : pack ? "Rebuild prep pack" : "Build my prep pack"}
          </Button>
        </div>
        {running && <p className="mt-3 text-sm text-muted">Researching the company and writing your pack. Usually under two minutes; you can leave this page.</p>}
        {run?.status === "failed" && !running && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{run.error ?? "The last attempt didn't finish."}</p>}
      </Card>

      {pack && (
        <div className="mt-6 space-y-6">
          <Card>
            <h2 className="font-semibold">{job.company} in brief</h2>
            <p className="mt-2 text-sm">{pack.company_brief.summary}</p>
            {pack.company_brief.what_they_value.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{pack.company_brief.what_they_value.map((v) => <span key={v} className="rounded-full bg-card px-3 py-1 text-xs">{v}</span>)}</div>}
            {pack.company_brief.recent_developments.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{pack.company_brief.recent_developments.map((d) => <li key={d}>{d}</li>)}</ul>}
            {pack.sources && pack.sources.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {pack.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-wing hover:underline">{s.title.slice(0, 50)} <ExternalLink className="size-3" /></a>)}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">Based on the job posting only. Web research runs when your AI provider is Anthropic.</p>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between"><h2 className="font-semibold">Tell me about yourself</h2><CopyButton text={pack.tell_me_about_yourself} /></div>
              <p className="mt-2 whitespace-pre-line text-sm">{pack.tell_me_about_yourself}</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between"><h2 className="font-semibold">Why {job.company}</h2><CopyButton text={pack.why_this_company} /></div>
              <p className="mt-2 whitespace-pre-line text-sm">{pack.why_this_company}</p>
            </Card>
          </div>

          <Card>
            <h2 className="font-semibold">Likely questions</h2>
            <ul className="mt-3 divide-y divide-line">
              {pack.likely_questions.map((q) => (
                <li key={q.question} className="py-3">
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {CATEGORY[q.category]} · {q.why_they_ask}
                    {q.story_title && <span className="ml-1 rounded-full bg-wing/10 px-2 py-0.5 text-wing">Story: {q.story_title}</span>}
                  </p>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-card p-3 text-sm">{q.answer_outline}</p>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {pack.gaps_to_prepare.length > 0 && (
              <Card><h2 className="font-semibold">Gaps to prepare for</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{pack.gaps_to_prepare.map((g) => <li key={g}>{g}</li>)}</ul></Card>
            )}
            <Card>
              <div className="flex items-center justify-between"><h2 className="font-semibold">Questions to ask them</h2><CopyButton text={pack.questions_to_ask.map((q) => `• ${q}`).join("\n")} /></div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{pack.questions_to_ask.map((q) => <li key={q}>{q}</li>)}</ul>
            </Card>
          </div>
          {pack.day_before_checklist.length > 0 && (
            <Card><h2 className="font-semibold">Day-before checklist</h2><ul className="mt-2 space-y-1 text-sm">{pack.day_before_checklist.map((c) => <li key={c}>☐ {c}</li>)}</ul></Card>
          )}
        </div>
      )}

      <div className="mt-6">
        <Practice jobId={job.id} questions={pack ? pack.likely_questions.map((q) => q.question) : ["Tell me about yourself.", `Why ${job.company}?`, "Tell me about a time you disagreed with a teammate."]} history={history} />
      </div>
    </div>
  );
}
