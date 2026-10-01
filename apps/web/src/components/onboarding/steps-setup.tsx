"use client";

import { Check, Copy, Eye, EyeOff, FileText, KeyRound, Loader2, Lock, Puzzle, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { chooseAiMode, completeDocuments, finishOnboarding, prefillFromDocuments, saveCloudKey, type ActionResult, type PrefillResult } from "@/app/onboarding/actions";
import { PROVIDERS, type AiSettings, type CareerDocument, type Provider } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass, StepFooter, StepHeader } from "./fields";

type Nav = { onDone: () => void; onBack?: () => void; embedded?: boolean };

const DOC_SLOTS: { kind: CareerDocument["kind"]; title: string; hint: string; accept: string; how?: string }[] = [
  { kind: "resume", title: "Resume", hint: "PDF or DOCX. The most useful thing you can add.", accept: ".pdf,.docx" },
  {
    kind: "linkedin_pdf",
    title: "LinkedIn profile PDF",
    hint: "Your profile as LinkedIn exports it.",
    accept: ".pdf",
    how: "On LinkedIn: open your profile → Resources (or More) → Save to PDF.",
  },
  {
    kind: "linkedin_export",
    title: "LinkedIn data export",
    hint: "ZIP with your connections and messages. Powers Referral Scout.",
    accept: ".zip",
    how: "On LinkedIn: Settings → Data privacy → Get a copy of your data. LinkedIn emails it within about a day, so you can add it later.",
  },
];

const formatSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function DocumentsStep({
  userId,
  documents,
  onDocuments,
  onDone,
  onBack,
  embedded,
}: Omit<Nav, "onDone"> & { onDone: (prefill?: PrefillResult) => void; userId: string; documents: CareerDocument[]; onDocuments: (d: CareerDocument[]) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: CareerDocument["kind"], file: File) {
    setError(undefined);
    if (file.size > 50 * 1024 * 1024) return setError("Files must be under 50 MB.");
    setUploading(kind);
    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${kind}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("career-docs").upload(path, file, { contentType: file.type || undefined });
    if (upErr) {
      setUploading(null);
      return setError(`Upload failed: ${upErr.message}`);
    }
    const { data, error: dbErr } = await supabase
      .from("career_documents")
      .insert({ user_id: userId, kind, storage_path: path, file_name: file.name, size_bytes: file.size })
      .select("id, kind, file_name, size_bytes")
      .single();
    setUploading(null);
    if (dbErr || !data) return setError("Saved the file but couldn't record it. Please try again.");
    onDocuments([...documents, data as CareerDocument]);
  }

  async function remove(doc: CareerDocument) {
    const supabase = createClient();
    const { data } = await supabase.from("career_documents").delete().eq("id", doc.id).select("storage_path").single();
    if (data) await supabase.storage.from("career-docs").remove([data.storage_path]);
    onDocuments(documents.filter((d) => d.id !== doc.id));
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        setError(undefined);
        start(async () => {
          // With a resume or LinkedIn PDF, read it to prefill the next screen; otherwise just move on.
          const hasText = documents.some((d) => d.kind !== "linkedin_export");
          const r: PrefillResult = hasText ? await prefillFromDocuments() : await completeDocuments();
          if (r.error) setError(r.error);
          else onDone(r);
        });
      }}
    >
      {!embedded && (
        <StepHeader
          title="Start with your resume"
          subtitle="Upload it (or your LinkedIn profile PDF) and we'll fill in the rest for you to check. Agents never invent anything that isn't in it."
        />
      )}
      <div className="space-y-3">
        {DOC_SLOTS.map((slot) => {
          const files = documents.filter((d) => d.kind === slot.kind);
          return (
            <div key={slot.kind} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{slot.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{slot.hint}</p>
                  {slot.how && <p className="mt-2 text-xs text-muted"><span className="font-medium text-foreground">How:</span> {slot.how}</p>}
                </div>
                <button type="button" onClick={() => inputs.current[slot.kind]?.click()} disabled={!!uploading} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:border-wing hover:text-wing disabled:opacity-60">
                  {uploading === slot.kind ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Upload
                </button>
                <input
                  ref={(el) => { inputs.current[slot.kind] = el; }}
                  type="file"
                  accept={slot.accept}
                  hidden
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (f) upload(slot.kind, f);
                    ev.target.value = "";
                  }}
                />
              </div>
              {files.map((d) => (
                <div key={d.id} className="mt-3 flex items-center gap-3 rounded-xl bg-card px-3 py-2 text-sm">
                  <FileText className="size-4 text-wing" />
                  <span className="flex-1 truncate">{d.file_name}</span>
                  <span className="text-xs text-muted">{formatSize(d.size_bytes)}</span>
                  <button type="button" onClick={() => remove(d)} aria-label={`Remove ${d.file_name}`} className="text-muted hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Lock className="size-3.5" /> Files are private to your account. You can delete them anytime.
      </p>
      {embedded ? (
        error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : (
        <>
          {pending && documents.some((d) => d.kind !== "linkedin_export") && (
            <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin text-wing" /> Reading your resume…</p>
          )}
          <StepFooter busy={pending} error={error} onBack={onBack} label={documents.length ? "Continue" : "Skip for now"} />
        </>
      )}
    </form>
  );
}

const MODES = [
  { id: "starter", icon: Sparkles, title: "Starter", tag: "No key needed", body: "Try Offerwing on us: profile audit, first job shortlist and a few drafts a day." },
  { id: "private", icon: Lock, title: "Private", tag: "Key stays in your browser", body: "Most private. Your key never reaches our servers. Agents run while your browser is open." },
  { id: "cloud", icon: KeyRound, title: "Always-on", tag: "Encrypted key in the cloud", body: "Agents work 24/7: overnight job scoring, morning brief and reminders." },
] as const;

export function AiStep({ ai, onAi, onDone, onBack, embedded }: Nav & { ai: AiSettings; onAi: (a: AiSettings) => void }) {
  const [mode, setMode] = useState<AiSettings["mode"]>(ai.mode);
  const [provider, setProvider] = useState<Provider>(ai.provider ?? "openai");
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  const keepExisting = mode === "cloud" && ai.mode === "cloud" && ai.provider === provider && !key;
  const providerInfo = PROVIDERS.find(([id]) => id === provider)!;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    start(async () => {
      if (keepExisting) return onDone();
      const r = mode === "cloud" ? await saveCloudKey(provider, key) : await chooseAiMode(mode, mode === "private" ? provider : null);
      setResult(r);
      if (r.error || r.fieldErrors) return;
      onAi({ mode, provider: mode === "starter" ? null : provider, key_last4: mode === "cloud" ? key.trim().slice(-4) : null });
      setKey("");
      onDone();
    });
  }

  return (
    <form onSubmit={submit}>
      {!embedded && <StepHeader title="Power your AI" subtitle="Offerwing is free because you bring your own AI key. Start with Starter and switch anytime in Settings." />}
      <div className="grid gap-3 md:grid-cols-3">
        {MODES.map(({ id, icon: Icon, title, tag, body }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`flex flex-col rounded-2xl border p-5 text-left transition-colors ${mode === id ? "border-wing bg-wing/5 ring-1 ring-wing" : "border-line bg-white hover:border-wing/50"}`}
          >
            <Icon className="size-5 text-wing" />
            <p className="mt-4 font-semibold">{title}</p>
            <p className="text-xs font-medium text-wing">{tag}</p>
            <p className="mt-2 text-xs text-muted">{body}</p>
          </button>
        ))}
      </div>

      {mode !== "starter" && (
        <div className="mt-8 space-y-6">
          <Field label="AI provider">
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map(([id, label]) => (
                <button key={id} type="button" onClick={() => setProvider(id)} aria-pressed={provider === id} className={`rounded-full border px-4 py-2 text-sm ${provider === id ? "border-wing bg-wing text-white" : "border-line bg-white hover:border-wing/50"}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {mode === "cloud" ? (
            <Field
              label={`${providerInfo[1]} API key`}
              hint={ai.mode === "cloud" && ai.provider === provider && ai.key_last4 ? `A key ending in …${ai.key_last4} is saved. Paste a new one to replace it.` : "We check it with a free test call, then encrypt it. It's never shown again."}
              error={result.fieldErrors?.key}
            >
              <div className="relative">
                <input type={show ? "text" : "password"} autoComplete="off" spellCheck={false} className={`${inputClass} pr-11 font-mono`} placeholder={providerInfo[2]} value={key} onChange={(ev) => setKey(ev.target.value)} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          ) : (
            <div className="flex gap-3 rounded-2xl bg-card p-4 text-sm">
              <Puzzle className="mt-0.5 size-5 shrink-0 text-wing" />
              <p className="text-muted">
                You&apos;ll paste your key into the <span className="font-medium text-foreground">Offerwing browser extension</span>, which keeps it on this device only. We&apos;ll prompt you when the extension is installed. Until then, Starter credits keep you going.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-line p-4 text-xs text-muted">
            <p className="font-medium text-foreground">Keep your key safe</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Create a separate key just for Offerwing, <a href={providerInfo[3]} target="_blank" rel="noreferrer" className="text-wing underline">here</a>.</li>
              <li>Set a monthly spending limit in your provider dashboard. Typical use is a few dollars a month.</li>
              <li>You can remove or rotate it anytime in Settings → AI & Keys.</li>
            </ul>
          </div>
        </div>
      )}
      <StepFooter
        busy={pending}
        error={result.error}
        onBack={embedded ? undefined : onBack}
        label={mode === "cloud" && !keepExisting ? (embedded ? "Verify & save key" : "Verify key & continue") : embedded ? "Save changes" : "Continue"}
      />
    </form>
  );
}

export function ConnectStep({ address, onBack }: { address: string; onBack: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); start(async () => { const r = await finishOnboarding(); if (r?.error) setError(r.error); }); }}>
      <StepHeader title="Connect your job search" subtitle="Two optional connections make your agents much smarter. You can do both later from the dashboard." />
      <div className="space-y-3">
        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <p className="font-medium">Forward LinkedIn job alerts</p>
          </div>
          <p className="mt-1 text-sm text-muted">Your personal alert address. Agents will score every job LinkedIn emails you.</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-card px-4 py-3 font-mono text-sm">
            <span className="flex-1 truncate">{address}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-muted hover:text-wing"
              aria-label="Copy address"
            >
              {copied ? <Check className="size-4 text-wing" /> : <Copy className="size-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Step-by-step Gmail and Outlook setup is in Settings → Job sources. You can also follow company careers pages there.</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2">
            <p className="font-medium">Install the browser extension</p>
          </div>
          <p className="mt-1 text-sm text-muted">Fit scores, referral paths and one-click saving right beside LinkedIn, only when you click. After installing, connect it at offerwing.app/extension/connect.</p>
        </div>
      </div>
      <StepFooter busy={pending} error={error} onBack={onBack} label="Go to my dashboard" />
    </form>
  );
}
