import { useEffect, useMemo, useState } from "react";
import { FORM_ANSWERS_SYSTEM, formAnswersSchema, type FormAnswers } from "@/lib/agents/form-answers";
import { ATS_NAMES, atsRef, fitAnswer, planFill, type AutofillData, type FillAction, type FormField } from "@/lib/autofill";
import { api, apiFile } from "../lib/api";
import { FriendlyError } from "../lib/errors";
import { fillForm, scanForm, type FillResult, type ScanResult } from "../lib/form";
import type { Me } from "./types";
import { AppLink, Button, Card, Notice, Spinner } from "./ui";

type Job = { id: string; title: string; company: string; stage: string; hasKit: boolean };
type Autofill = AutofillData & { ats: string | null; job: Job | null; matched: boolean; candidates: Job[]; profileSaved: boolean; kitId: string | null };
type Draft = { frameId: number; ref: string; kind: FormField["kind"]; label: string; options: string[]; answer: string; needsReview: boolean };

// Hosts the extension may read without asking (see manifest host_permissions). Anything else
// needs a one-time, per-site permission the user grants from this panel.
const STATIC_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(greenhouse\.io|myworkdayjobs\.com|myworkdaysite\.com)\/|^https:\/\/(jobs\.lever\.co|jobs\.eu\.lever\.co|jobs\.ashbyhq\.com|jobs\.smartrecruiters\.com|apply\.workable\.com)\//;

const originPattern = (url: string) => `${new URL(url).origin}/*`;

export function ApplyView({ me, tab }: { me: Me; tab: { id: number; url: string } }) {
  const ref = atsRef(tab.url);
  const [allowed, setAllowed] = useState<boolean | null>(STATIC_HOSTS.test(tab.url) ? true : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [scan, setScan] = useState<{ fields: FormField[]; title: string } | null>(null);
  const [data, setData] = useState<Autofill | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [result, setResult] = useState<FillResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [manual, setManual] = useState({ title: "", company: "" });

  useEffect(() => {
    if (allowed !== null) return;
    void chrome.permissions.contains({ origins: [originPattern(tab.url)] }).then(setAllowed);
  }, [allowed, tab.url]);

  const plan = useMemo(() => (scan && data ? planFill(scan.fields, data) : null), [scan, data]);
  const actions: FillAction[] = useMemo(() => {
    const planned = (plan?.actions ?? []).filter((a) => !off.has(`${a.frameId}:${a.ref}`));
    const drafted = drafts
      .map((d) => ({ ...d, value: fitAnswer(d, d.answer) }))
      .filter((d): d is Draft & { value: string } => !!d.value && !off.has(`${d.frameId}:${d.ref}`))
      .map((d) => ({ frameId: d.frameId, ref: d.ref, kind: d.kind, label: d.label, value: d.value, source: "AI draft (reviewed by you)" }));
    return [...planned, ...drafted];
  }, [plan, drafts, off]);
  const openQuestions = (plan?.open ?? []).filter((q) => !drafts.some((d) => d.ref === q.ref && d.frameId === q.frameId));

  async function load(jobId: string | null) {
    setData(await api<Autofill>("/api/ext/autofill", { body: { url: tab.url, jobId } }));
  }

  async function start() {
    setError(undefined);
    // Must be the first thing in the click handler: Chrome only shows the prompt during a user gesture.
    if (!allowed) {
      const granted = await chrome.permissions.request({ origins: [originPattern(tab.url)] });
      setAllowed(granted);
      if (!granted) return setError("Offerwing needs permission to read this page's form. Nothing is read until you allow it.");
    }
    setBusy("scan");
    try {
      const [results] = await Promise.all([chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scanForm }), load(null)]);
      const fields = results.flatMap((r) => ((r.result as ScanResult | undefined)?.fields ?? []).map((f) => ({ ...f, frameId: r.frameId })));
      const title = (results.find((r) => r.frameId === 0)?.result as ScanResult | undefined)?.title ?? "";
      if (!fields.length) throw new FriendlyError("No form fields found. Open the application form (click Apply on the job page), then try again.");
      setScan({ fields, title });
      setManual((m) => ({ ...m, title: m.title || title.split(/[|\-–—@]/)[0].trim().slice(0, 200) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this page.");
    }
    setBusy(null);
  }

  async function draftAnswers() {
    if (!openQuestions.length) return;
    setBusy("draft");
    setError(undefined);
    try {
      const questions = openQuestions.slice(0, 15).map((q) => ({ question: q.label.slice(0, 500), options: q.options.slice(0, 30), long: q.kind === "textarea" }));
      let answers: FormAnswers["answers"];
      if (me.aiMode === "private") {
        const { getPrivateKey } = await import("../lib/private-key");
        const key = await getPrivateKey();
        if (!key) throw new FriendlyError("Add your AI key in the extension settings to draft answers in Private mode.");
        const { context, prompt } = await api<{ context: string; prompt: string }>("/api/ext/form-answers", { body: { jobId: data?.job?.id ?? null, questions, prepareOnly: true } });
        const { generateInBrowser } = await import("../lib/llm");
        answers = (await generateInBrowser({ key, tier: "standard", system: FORM_ANSWERS_SYSTEM, context, prompt, schema: formAnswersSchema, schemaName: "form_answers" })).data.answers;
      } else {
        answers = (await api<FormAnswers>("/api/ext/form-answers", { body: { jobId: data?.job?.id ?? null, questions } })).answers;
      }
      const qs = openQuestions.slice(0, 15).map((q, i) => ({ ...q, answer: answers[i]?.answer ?? "", needsReview: answers[i]?.needs_review ?? true }));
      setDrafts((prev) => [...prev, ...qs]);
      // Answers that need a fact only the user knows start unticked.
      setOff((s) => new Set([...s, ...qs.filter((d) => d.needsReview).map((d) => `${d.frameId}:${d.ref}`)]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft answers.");
    }
    setBusy(null);
  }

  async function fill() {
    setBusy("fill");
    setError(undefined);
    try {
      const resume = actions.some((a) => a.kind === "file") ? await apiFile(`/api/ext/resume${data?.job ? `?jobId=${data.job.id}` : ""}`) : null;
      const byFrame = new Map<number, FillAction[]>();
      for (const a of actions) byFrame.set(a.frameId, [...(byFrame.get(a.frameId) ?? []), a]);
      const total: FillResult = { filled: [], failed: [] };
      for (const [frameId, list] of byFrame) {
        const [r] = await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [frameId] },
          func: fillForm,
          args: [list.map(({ ref, kind, value, label }) => ({ ref, kind, value, label })), resume],
        });
        const out = r?.result as FillResult | undefined;
        total.filled.push(...(out?.filled ?? []));
        total.failed.push(...(out?.failed ?? list.map((a) => a.label)));
      }
      setResult(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fill the form.");
    }
    setBusy(null);
  }

  async function markApplied() {
    setBusy("applied");
    setError(undefined);
    try {
      await api("/api/ext/applied", { body: data?.job ? { jobId: data.job.id } : { url: tab.url, title: manual.title.trim(), company: manual.company.trim() } });
      setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update your pipeline.");
    }
    setBusy(null);
  }

  const toggle = (key: string) => setOff((s) => (s.has(key) ? new Set([...s].filter((k) => k !== key)) : new Set(s).add(key)));

  if (!scan || !data) {
    return (
      <Card>
        <p className="eyebrow">{ref ? `${ATS_NAMES[ref.ats]} application` : "Job application helper"}</p>
        <p className="title-sm">{ref ? "Fill this application from your details" : "Filling in a job application?"}</p>
        <p className="muted small">
          Offerwing fills the fields it knows (contact details, links, resume, your kit&apos;s answers) and shows you everything first. You review the page and submit it yourself.
        </p>
        {!me.hasApplicationProfile && (
          <Notice tone="warn">
            Add your application details once so forms can be filled: <AppLink path="/dashboard/settings#applications">Settings → Applications</AppLink>
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <Button onClick={start} disabled={!!busy}>{busy && <Spinner />} {allowed ? "Scan this form" : "Allow on this site & scan"}</Button>
        {!ref && <p className="muted small">Not a form? LinkedIn job, profile and company pages have their own tools.</p>}
      </Card>
    );
  }

  const skipped = plan?.skipped ?? [];
  return (
    <>
      <Card>
        <p className="eyebrow">{ref ? `${ATS_NAMES[ref.ats]} application` : "Application form"}</p>
        {data.job ? (
          <>
            <p className="title-sm">{data.job.title}</p>
            <p className="muted small">{data.job.company} · {data.job.hasKit ? "using your application kit" : "no application kit yet"}</p>
          </>
        ) : (
          <p className="muted small">This form isn&apos;t linked to a job in your pipeline.</p>
        )}
        {(data.candidates.length > 0 || data.job) && (
          <select
            className="input"
            value={data.job?.id ?? ""}
            onChange={async (e) => {
              setBusy("job");
              setDrafts([]);
              try {
                await load(e.target.value || null);
              } catch (err) {
                setError((err as Error).message);
              }
              setBusy(null);
            }}
          >
            <option value="">No pipeline job</option>
            {data.job && <option value={data.job.id}>{data.job.title} · {data.job.company}</option>}
            {data.candidates.filter((c) => c.id !== data.job?.id).map((c) => (
              <option key={c.id} value={c.id}>{c.title} · {c.company}{c.hasKit ? " · kit" : ""}</option>
            ))}
          </select>
        )}
        {data.job && !data.job.hasKit && <AppLink path={`/dashboard/jobs/${data.job.id}/kit`}>Tailor a resume and answers for this job first →</AppLink>}
        {!data.profileSaved && (
          <Notice tone="warn">Using your name and email only. <AppLink path="/dashboard/settings#applications">Add application details</AppLink> to fill more.</Notice>
        )}
      </Card>

      <Card title={`Ready to fill (${actions.length})`}>
        {actions.length === 0 ? (
          <p className="muted small">Nothing Offerwing can fill on this form yet.</p>
        ) : (
          <div className="fill-list">
            {[...(plan?.actions ?? []), ...drafts.map((d) => ({ ...d, value: fitAnswer(d, d.answer) ?? "", source: "AI draft" }))].map((a) => {
              const key = `${a.frameId}:${a.ref}`;
              const draft = drafts.find((d) => d.ref === a.ref && d.frameId === a.frameId);
              return (
                <label key={key} className="fill-row">
                  <input type="checkbox" checked={!off.has(key)} onChange={() => toggle(key)} />
                  <span className="fill-main">
                    <span className="fill-label">{a.label}</span>
                    {draft ? (
                      <>
                        <textarea
                          className="input fill-edit"
                          rows={draft.kind === "textarea" ? 5 : 2}
                          value={draft.answer}
                          onChange={(e) => setDrafts((ds) => ds.map((d) => (d === draft ? { ...d, answer: e.target.value } : d)))}
                        />
                        {draft.needsReview && <span className="fill-warn">Check this one: it may need a fact only you know.</span>}
                        {!fitAnswer(draft, draft.answer) && <span className="fill-warn">Doesn&apos;t match any of the options: fill it yourself.</span>}
                      </>
                    ) : (
                      <span className="fill-value">{a.kind === "file" ? (data.job?.hasKit ? "Tailored resume (.docx)" : "Your uploaded resume") : a.value}</span>
                    )}
                    <span className="fill-source">{a.source}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {result ? (
          <>
            <Notice tone={result.failed.length ? "warn" : "info"}>
              Filled {result.filled.length} field{result.filled.length === 1 ? "" : "s"} (outlined in purple).
              {result.failed.length > 0 && ` Couldn't fill: ${result.failed.join(", ")}.`} Review the whole form, then submit it yourself.
            </Notice>
            <Button kind="ghost" onClick={fill} disabled={!!busy}>Fill again</Button>
          </>
        ) : (
          <Button onClick={fill} disabled={!!busy || actions.length === 0}>{busy === "fill" && <Spinner />} Fill {actions.length} field{actions.length === 1 ? "" : "s"}</Button>
        )}
      </Card>

      {openQuestions.length > 0 && (
        <Card title={`Questions for you (${openQuestions.length})`}>
          <ul className="list">{openQuestions.slice(0, 12).map((q) => <li key={`${q.frameId}:${q.ref}`}>{q.label}</li>)}</ul>
          <p className="muted small">Draft answers from your documents, edit them above, then fill. Nothing is invented: missing facts become [placeholders].</p>
          <Button kind="ghost" onClick={draftAnswers} disabled={!!busy}>{busy === "draft" && <Spinner />} Draft {Math.min(openQuestions.length, 15)} answers with AI</Button>
        </Card>
      )}

      {skipped.length > 0 && (
        <Card title="Left for you">
          <ul className="list small">{skipped.map((s, i) => <li key={i}>{s.label}: <span className="muted">{s.reason}</span></li>)}</ul>
        </Card>
      )}

      {result && (
        <Card title="Submitted it?">
          {applied ? (
            <Notice>Moved to Applied in your pipeline. Good luck!</Notice>
          ) : (
            <>
              {!data.job && (
                <>
                  <input className="input" placeholder="Job title" value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} />
                  <input className="input" placeholder="Company" value={manual.company} onChange={(e) => setManual((m) => ({ ...m, company: e.target.value }))} />
                </>
              )}
              <Button onClick={markApplied} disabled={!!busy || (!data.job && (!manual.title.trim() || !manual.company.trim()))}>
                {busy === "applied" && <Spinner />} I submitted it: mark as applied
              </Button>
            </>
          )}
        </Card>
      )}
    </>
  );
}
