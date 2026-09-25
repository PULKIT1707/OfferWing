"use client";

import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteJob, saveJob } from "@/app/dashboard/actions";
import { CHANNELS, STAGES, type Job } from "@/lib/dashboard";
import { inputClass } from "@/components/onboarding/fields";
import { Button, label } from "./ui";

export function JobForm({ job, defaultStage = "saved", onSaved, onDeleted }: { job?: Job; defaultStage?: Job["stage"]; onSaved: (j: Job) => void; onDeleted?: (id: string) => void }) {
  const [v, setV] = useState({
    title: job?.title ?? "",
    company: job?.company ?? "",
    url: job?.url ?? "",
    location: job?.location ?? "",
    stage: job?.stage ?? defaultStage,
    channel: job?.channel ?? null,
    next_action: job?.next_action ?? "",
    next_action_at: job?.next_action_at ?? "",
    description: job?.description ?? "",
    notes: job?.notes ?? "",
  });
  const set = (patch: Partial<typeof v>) => setV((p) => ({ ...p, ...patch }));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      // Only send stage when it changed, so stage timestamps stay accurate.
      const payload = job && v.stage === job.stage ? { ...v, stage: undefined } : v;
      const r = await saveJob(job?.id ?? null, payload);
      if (r.ok) onSaved(r.data);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="job-title">Job title</label>
          <input id="job-title" required className={inputClass} value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Senior Product Designer" />
        </div>
        <div>
          <label className={label} htmlFor="job-company">Company</label>
          <input id="job-company" required className={inputClass} value={v.company} onChange={(e) => set({ company: e.target.value })} placeholder="Stripe" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="job-url">Job link</label>
        <div className="flex gap-2">
          <input id="job-url" className={inputClass} value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://www.linkedin.com/jobs/view/…" />
          {job?.url && (
            <a href={job.url} target="_blank" rel="noreferrer" aria-label="Open job link" className="grid place-items-center rounded-xl border border-line px-3 text-muted hover:text-wing">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="job-location">Location</label>
          <input id="job-location" className={inputClass} value={v.location} onChange={(e) => set({ location: e.target.value })} placeholder="Remote" />
        </div>
        <div>
          <label className={label} htmlFor="job-stage">Stage</label>
          <select id="job-stage" className={inputClass} value={v.stage} onChange={(e) => set({ stage: e.target.value as Job["stage"] })}>
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="job-channel">How you applied</label>
          <select id="job-channel" className={inputClass} value={v.channel ?? ""} onChange={(e) => set({ channel: (e.target.value || null) as Job["channel"] })}>
            <option value="">Not yet</option>
            {CHANNELS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label className={label} htmlFor="job-next">Next step</label>
          <input id="job-next" className={inputClass} value={v.next_action} onChange={(e) => set({ next_action: e.target.value })} placeholder="Ask Priya for a referral" />
        </div>
        <div>
          <label className={label} htmlFor="job-next-at">Due</label>
          <input id="job-next-at" type="date" className={inputClass} value={v.next_action_at} onChange={(e) => set({ next_action_at: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="job-description">Job description</label>
        <textarea
          id="job-description"
          rows={5}
          className={inputClass}
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Paste the full job description. The Job Match agent needs it to score your fit."
        />
      </div>
      <div>
        <label className={label} htmlFor="job-notes">Notes</label>
        <textarea id="job-notes" rows={3} className={inputClass} value={v.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Recruiter name, salary range, anything useful…" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 pt-2">
        {job && onDeleted ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Delete "${job.title}" at ${job.company}?`)) return;
              start(async () => {
                const r = await deleteJob(job.id);
                if (r.ok) onDeleted(job.id);
                else setError(r.error);
              });
            }}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {job ? "Save changes" : "Add job"}
        </Button>
      </div>
    </form>
  );
}
