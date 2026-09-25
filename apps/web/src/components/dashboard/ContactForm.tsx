"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteContact, saveContact } from "@/app/dashboard/actions";
import { REFERRAL_STATUSES, RELATIONSHIPS, sameCompany, type Contact, type Job } from "@/lib/dashboard";
import { inputClass } from "@/components/onboarding/fields";
import { Button, label } from "./ui";

export function ContactForm({
  contact,
  defaultCompany,
  jobs,
  onSaved,
  onDeleted,
}: {
  contact?: Contact;
  defaultCompany?: string;
  jobs: Job[];
  onSaved: (c: Contact) => void;
  onDeleted?: (id: string) => void;
}) {
  const [v, setV] = useState({
    full_name: contact?.full_name ?? "",
    company: contact?.company ?? defaultCompany ?? "",
    title: contact?.title ?? "",
    relationship: contact?.relationship ?? "connection",
    strength: contact?.strength ?? 2,
    linkedin_url: contact?.linkedin_url ?? "",
    referral_status: contact?.referral_status ?? (defaultCompany ? "to_ask" : "none"),
    job_id: contact?.job_id ?? null,
    notes: contact?.notes ?? "",
    last_contacted_at: contact?.last_contacted_at ?? "",
    next_follow_up_at: contact?.next_follow_up_at ?? "",
  });
  const set = (patch: Partial<typeof v>) => setV((p) => ({ ...p, ...patch }));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const companyJobs = jobs.filter((j) => sameCompany(j.company, v.company));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveContact(contact?.id ?? null, v);
      if (r.ok) onSaved(r.data);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-name">Name</label>
          <input id="c-name" required className={inputClass} value={v.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Priya Shah" />
        </div>
        <div>
          <label className={label} htmlFor="c-company">Company</label>
          <input id="c-company" className={inputClass} value={v.company} onChange={(e) => set({ company: e.target.value, job_id: null })} placeholder="Stripe" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-title">Their role</label>
          <input id="c-title" className={inputClass} value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Design Lead" />
        </div>
        <div>
          <label className={label} htmlFor="c-rel">How you know them</label>
          <select id="c-rel" className={inputClass} value={v.relationship} onChange={(e) => set({ relationship: e.target.value as Contact["relationship"] })}>
            {RELATIONSHIPS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className={label}>How well do you know them?</p>
        <div className="grid grid-cols-3 gap-2">
          {([[1, "Barely"], [2, "Somewhat"], [3, "Well"]] as const).map(([s, l]) => (
            <button key={s} type="button" aria-pressed={v.strength === s} onClick={() => set({ strength: s })} className={`rounded-xl border px-3 py-2 text-sm ${v.strength === s ? "border-wing bg-wing/5 ring-1 ring-wing" : "border-line hover:border-wing/50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={label} htmlFor="c-url">LinkedIn profile link</label>
        <input id="c-url" className={inputClass} value={v.linkedin_url} onChange={(e) => set({ linkedin_url: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-ref">Referral</label>
          <select id="c-ref" className={inputClass} value={v.referral_status} onChange={(e) => set({ referral_status: e.target.value as Contact["referral_status"] })}>
            {REFERRAL_STATUSES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="c-job">For which job</label>
          <select id="c-job" className={inputClass} value={v.job_id ?? ""} onChange={(e) => set({ job_id: e.target.value || null })} disabled={!companyJobs.length}>
            <option value="">{companyJobs.length ? "Any role" : "No saved jobs at this company"}</option>
            {companyJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-last">Last contacted</label>
          <input id="c-last" type="date" className={inputClass} value={v.last_contacted_at} onChange={(e) => set({ last_contacted_at: e.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="c-next">Follow up on</label>
          <input id="c-next" type="date" className={inputClass} value={v.next_follow_up_at} onChange={(e) => set({ next_follow_up_at: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="c-notes">Notes</label>
        <textarea id="c-notes" rows={3} className={inputClass} value={v.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Worked together at Acme 2021–23…" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 pt-2">
        {contact && onDeleted ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Remove ${contact.full_name}?`)) return;
              start(async () => {
                const r = await deleteContact(contact.id);
                if (r.ok) onDeleted(contact.id);
                else setError(r.error);
              });
            }}
          >
            <Trash2 className="size-4" /> Remove
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {contact ? "Save changes" : "Add person"}
        </Button>
      </div>
    </form>
  );
}
