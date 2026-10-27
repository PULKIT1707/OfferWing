"use client";

import { AlertTriangle, Building2, Check, Copy, ExternalLink, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addJobSource, checkSourcesNow, removeJobSource, saveTitleExclusions, setSourceMatching } from "@/app/dashboard/jobs/discovery-actions";
import { SOURCE_LABEL, type SourceKind } from "@/lib/source-kinds";
import { inputClass } from "@/components/onboarding/fields";
import { Button } from "./ui";

export type JobSource = {
  id: string;
  kind: SourceKind;
  board_token: string;
  company_name: string;
  only_matching: boolean;
  last_checked_at: string | null;
  last_found: number | null;
  last_error: string | null;
};
export type InboundEmailRow = {
  id: string;
  from_address: string | null;
  subject: string | null;
  kind: "linkedin_alert" | "forwarding_confirmation" | "other";
  jobs_found: number;
  detail: { code?: string | null; link?: string | null; parsed?: number } | null;
  received_at: string;
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function AlertAddress({ address, emails }: { address: string; emails: InboundEmailRow[] }) {
  const [copied, setCopied] = useState(false);
  const confirmation = emails.find((e) => e.kind === "forwarding_confirmation");
  const lastAlert = emails.find((e) => e.kind === "linkedin_alert");
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="flex items-center gap-2 font-medium">
        <Mail className="size-4 text-wing" /> LinkedIn job alerts
      </p>
      <p className="mt-1 text-sm text-muted">Forward LinkedIn&apos;s job-alert emails to your personal address. New jobs land in your pipeline inbox.</p>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-card px-4 py-3 font-mono text-sm">
        <span className="flex-1 truncate">{address}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(address).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label="Copy address"
          className="text-muted hover:text-wing"
        >
          {copied ? <Check className="size-4 text-wing" /> : <Copy className="size-4" />}
        </button>
      </div>

      {confirmation && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Gmail is asking you to confirm forwarding</p>
          <p className="mt-1">
            In Gmail: Settings → Forwarding and POP/IMAP → paste this confirmation code:{" "}
            <span className="font-mono font-semibold">{confirmation.detail?.code ?? "(see link)"}</span>
          </p>
          {confirmation.detail?.link && (
            <a href={confirmation.detail.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium underline">
              Or confirm with Google&apos;s link <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-wing">How to set it up</summary>
        <div className="mt-3 space-y-4 text-muted">
          <div>
            <p className="font-medium text-foreground">Gmail</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Settings (gear) → See all settings → Forwarding and POP/IMAP → Add a forwarding address → paste the address above.</li>
              <li>Gmail sends us a confirmation. The code appears right here within a minute; enter it in Gmail.</li>
              <li>Create a filter: From <span className="font-mono">jobalerts-noreply@linkedin.com</span> → Forward it to your Offerwing address.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground">Outlook</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Settings → Mail → Rules → Add new rule.</li>
              <li>Condition: From contains <span className="font-mono">jobalerts-noreply@linkedin.com</span>. Action: Forward to your Offerwing address.</li>
            </ol>
          </div>
          <p>Only job alerts are used. We keep each email&apos;s subject and sender for 30 days, never its full content.</p>
        </div>
      </details>

      <p className="mt-4 text-xs text-muted">
        {lastAlert ? `Last alert received ${when(lastAlert.received_at)}: ${lastAlert.jobs_found} new ${lastAlert.jobs_found === 1 ? "job" : "jobs"}.` : "No alerts received yet."}
      </p>
    </div>
  );
}

function CareerBoards({ sources }: { sources: JobSource[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } & Record<string, unknown>>, ok: (r: Record<string, unknown>) => string | null) => {
    // Clear right away: updates inside the transition only show once it finishes.
    setMessage(undefined);
    start(async () => {
      const r = await fn();
      if (r.error) setMessage({ tone: "error", text: r.error });
      else {
        const text = ok(r);
        if (text) setMessage({ tone: "ok", text });
      }
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <Building2 className="size-4 text-wing" /> Company careers pages
          </p>
          <p className="mt-1 text-sm text-muted">Follow companies that hire through Greenhouse, Lever, Ashby, SmartRecruiters, Workable or Recruitee. We check every few hours and add roles matching your targets, with full descriptions.</p>
        </div>
        {sources.length > 0 && (
          <Button variant="ghost" className="px-3 py-2 text-xs" disabled={pending} onClick={() => run(checkSourcesNow, (r) => `Checked ${r.checked} ${r.checked === 1 ? "page" : "pages"}: ${r.added} new ${r.added === 1 ? "job" : "jobs"}.`)}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Check now
          </Button>
        )}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addJobSource(url),
            (r) => {
              setUrl("");
              return `Following ${r.companyName}: ${r.added} matching ${r.added === 1 ? "job" : "jobs"} added to your inbox.`;
            },
          );
        }}
      >
        <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="boards.greenhouse.io/stripe · jobs.lever.co/company · apply.workable.com/company" aria-label="Careers page link" />
        <Button disabled={pending || !url.trim()}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Follow</Button>
      </form>
      {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</p>}

      {sources.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {s.company_name} <span className="text-xs font-normal text-muted">· {SOURCE_LABEL[s.kind]}</span>
                </p>
                <p className="text-xs text-muted">
                  {s.last_error ? (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <AlertTriangle className="size-3" /> {s.last_error}
                    </span>
                  ) : s.last_checked_at ? (
                    `Checked ${when(s.last_checked_at)} · ${s.last_found ?? 0} new`
                  ) : (
                    "Not checked yet"
                  )}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={s.only_matching} onChange={(e) => run(() => setSourceMatching(s.id, e.target.checked), () => null)} className="accent-[var(--wing)]" />
                Only my target roles
              </label>
              <button onClick={() => run(() => removeJobSource(s.id), () => null)} aria-label={`Stop following ${s.company_name}`} className="text-muted hover:text-red-600">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TitleExclusions({ initial }: { initial: string[] }) {
  const [text, setText] = useState(initial.join(", "));
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveTitleExclusions(text.split(/[,\n]/));
      if (r.error) return setMessage({ tone: "error", text: r.error });
      setText((r.saved ?? []).join(", "));
      setMessage({ tone: "ok", text: r.saved?.length ? "Saved. Titles with these words won't reach your inbox." : "Saved. No titles are skipped." });
    });
  return (
    <div className="rounded-2xl border border-line p-5">
      <p className="font-medium">Skip titles containing</p>
      <p className="mt-1 text-sm text-muted">
        Whole words, separated by commas. Applies to alerts and careers pages, e.g. &quot;intern, contract, interior&quot; keeps &quot;Interior Designer&quot; out when you target Product Designer roles.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="intern, contract, interior" aria-label="Words to skip in job titles" />
        <Button disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Save</Button>
      </form>
      {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</p>}
    </div>
  );
}

export function JobSources({ alertAddress, sources, emails, titleExclude }: { alertAddress: string; sources: JobSource[]; emails: InboundEmailRow[]; titleExclude: string[] }) {
  return (
    <div className="space-y-4">
      <AlertAddress address={alertAddress} emails={emails} />
      <CareerBoards sources={sources} />
      <TitleExclusions initial={titleExclude} />
    </div>
  );
}
