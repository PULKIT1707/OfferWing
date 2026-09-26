"use client";

import { ChevronDown, ExternalLink, Inbox, Mail, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Job } from "@/lib/dashboard";
import { Button } from "./ui";

const SOURCE_LABEL: Record<Job["source"], string> = { alert: "LinkedIn alert", ats: "Careers page", extension: "Extension", manual: "Added" };

// Newly discovered jobs waiting for triage: save to the pipeline or dismiss.
export function JobInbox({ jobs, onSave, onDismiss }: { jobs: Job[]; onSave: (j: Job) => void; onDismiss: (j: Job) => void }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (!jobs.length) {
    return (
      <div className="mb-6 flex flex-col gap-2 rounded-3xl border border-dashed border-line bg-white/60 px-5 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <Inbox className="size-4 text-wing" /> New jobs from your LinkedIn alerts and followed careers pages land here.
        </span>
        <Link href="/dashboard/settings#sources" className="font-medium text-wing hover:underline">Set up job sources</Link>
      </div>
    );
  }

  // Jobs with a full description (careers pages) first: they can be scored right away.
  const sorted = [...jobs].sort((a, b) => Number(!!b.description) - Number(!!a.description) || b.created_at.localeCompare(a.created_at));
  const shown = showAll ? sorted : sorted.slice(0, 6);
  return (
    <section className="mb-6 rounded-3xl bg-white p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <Inbox className="size-5 text-wing" />
        <h2 className="font-semibold">Inbox</h2>
        <span className="rounded-full bg-wing px-2 py-0.5 text-xs font-semibold text-white">{jobs.length}</span>
        <span className="ml-2 hidden text-sm text-muted sm:inline">New jobs from your alerts and careers pages. Save the ones worth a look.</span>
        <ChevronDown className={`ml-auto size-4 text-muted transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <>
          <div className="mt-4 divide-y divide-line">
            {shown.map((j) => (
              <div key={j.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{j.title}</span>
                    {j.url && (
                      <a href={j.url} target="_blank" rel="noreferrer" aria-label="Open posting" className="shrink-0 text-muted hover:text-wing">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">{[j.company, j.location].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Mail className="size-3" /> {SOURCE_LABEL[j.source]}
                    {!j.description && j.source === "alert" && " · open it with the extension to add the description"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => onDismiss(j)} aria-label={`Dismiss ${j.title}`}>
                    <X className="size-3.5" /> Dismiss
                  </Button>
                  <Button className="px-3 py-2 text-xs" onClick={() => onSave(j)}>
                    <Plus className="size-3.5" /> {j.description ? "Save & score" : "Save"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {jobs.length > shown.length && (
            <button onClick={() => setShowAll(true)} className="mt-2 text-sm font-medium text-wing hover:underline">
              Show all {jobs.length}
            </button>
          )}
        </>
      )}
    </section>
  );
}
