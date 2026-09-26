"use client";

import { ArrowRight, Briefcase, CalendarClock, ChevronDown, Loader2, Plus, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { saveJob } from "@/app/dashboard/actions";
import { getLatestMatch, getScoringStatus, startJobMatches } from "@/app/dashboard/jobs/actions";
import type { MatchRun } from "@/lib/agents/job-match";
import { daysSince, OPEN_STAGES, sameCompany, STAGES, today, type Contact, type Job, type Stage } from "@/lib/dashboard";
import { JobForm } from "./JobForm";
import { JobInbox } from "./JobInbox";
import { JobMatchPanel } from "./JobMatchPanel";
import { Button, EmptyState, Modal, PageHeader } from "./ui";

function JobCard({ job, contacts, scoring, onOpen }: { job: Job; contacts: number; scoring: boolean; onOpen: () => void }) {
  const overdue = job.next_action_at && job.next_action_at <= today();
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/job-id", job.id)}
      onClick={onOpen}
      className="w-full cursor-grab rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-line transition hover:ring-wing active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug">{job.title}</p>
        {scoring ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-wing" aria-label="Scoring" />
        ) : (
          job.fit_score != null && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${job.fit_score >= 70 ? "bg-offer" : job.fit_score >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>
              {job.fit_score}%
            </span>
          )
        )}
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </p>
      {job.next_action && (
        <p className={`mt-3 flex items-center gap-1.5 text-xs ${overdue ? "font-medium text-red-600" : "text-muted"}`}>
          <CalendarClock className="size-3.5" /> {job.next_action}
          {job.next_action_at && ` · ${new Date(job.next_action_at + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{daysSince(job.stage_changed_at)}d in stage</span>
        {contacts > 0 && (
          <span className="flex items-center gap-1 text-wing">
            <Users className="size-3.5" /> {contacts} you know
          </span>
        )}
      </div>
    </button>
  );
}

export function JobsBoard({ initialJobs, contacts }: { initialJobs: Job[]; contacts: Contact[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [scoring, setScoring] = useState<string[]>([]);
  const [, start] = useTransition();
  const [queueing, startQueue] = useTransition();

  const setScore = useCallback((jobId: string, score: number | null) => {
    setJobs((all) => all.map((j) => (j.id === jobId && j.fit_score !== score ? { ...j, fit_score: score } : j)));
  }, []);

  // Fit analysis for the job open in the modal.
  const [matchRun, setMatchRun] = useState<MatchRun | null | undefined>(undefined);
  const openJob = (j: Job) => {
    setEditing(j);
    setMatchRun(undefined);
    void getLatestMatch(j.id).then(setMatchRun);
  };
  const editingId = editing && editing !== "new" ? editing.id : null;
  const refreshMatch = useCallback(async () => {
    if (!editingId) return;
    const latest = await getLatestMatch(editingId);
    setMatchRun(latest);
    if (latest?.status === "complete" && latest.result) setScore(editingId, latest.result.fit_score);
  }, [editingId, setScore]);

  // Poll while any job is being scored, updating badges as results land.
  useEffect(() => {
    if (!scoring.length) return;
    const t = setInterval(async () => {
      const status = await getScoringStatus();
      setJobs((all) => all.map((j) => (j.id in status.scores && status.scores[j.id] !== j.fit_score ? { ...j, fit_score: status.scores[j.id] } : j)));
      if (!status.running.length) {
        const failed = scoring.filter((id) => status.scores[id] == null).length;
        if (failed) setError(`${failed} ${failed === 1 ? "job" : "jobs"} couldn't be scored. Open ${failed === 1 ? "it" : "one"} to see why.`);
        setNotice(undefined);
      }
      setScoring(status.running);
    }, 4000);
    return () => clearInterval(t);
  }, [scoring]);

  const unscored = jobs.filter((j) => OPEN_STAGES.includes(j.stage) && j.fit_score == null && j.description?.trim()).length;
  function scoreAll() {
    setError(undefined);
    setNotice(undefined);
    startQueue(async () => {
      const r = await startJobMatches("unscored");
      if (r.error) setError(r.error);
      if (r.queued) {
        setNotice(`Scoring ${r.queued} ${r.queued === 1 ? "job" : "jobs"}…${r.skipped.length ? ` Skipped ${r.skipped.length}: ${r.skipped.map((s) => `${s.title} (${s.reason})`).join("; ")}.` : ""}`);
        setScoring((await getScoringStatus()).running);
      } else if (r.skipped.length && !r.error) {
        setError(`Nothing to score. ${r.skipped.map((s) => `${s.title}: ${s.reason}`).join("; ")}.`);
      }
    });
  }

  const upsert = (j: Job) => setJobs((all) => (all.some((x) => x.id === j.id) ? all.map((x) => (x.id === j.id ? j : x)) : [j, ...all]));
  const contactsAt = (company: string) => contacts.filter((c) => sameCompany(c.company, company)).length;

  function move(id: string, stage: Stage) {
    const before = jobs.find((j) => j.id === id);
    if (!before || before.stage === stage) return;
    setError(undefined);
    upsert({ ...before, stage, stage_changed_at: new Date().toISOString() });
    start(async () => {
      const r = await saveJob(id, { stage });
      if (r.ok) upsert(r.data);
      else {
        upsert(before);
        setError(r.error);
      }
    });
  }

  const inbox = jobs.filter((j) => j.stage === "discovered");
  const closed = jobs.filter((j) => !OPEN_STAGES.includes(j.stage) && j.stage !== "discovered");

  // Saving from the inbox moves the job into the pipeline and scores it when it has a description.
  function saveFromInbox(j: Job) {
    move(j.id, "saved");
    if (j.description) {
      void startJobMatches([j.id]).then(async (r) => {
        if (r.error) setError(`Saved, but couldn't score it: ${r.error}`);
        else if (r.queued) setScoring((await getScoringStatus()).running);
      });
    }
  }
  return (
    <div>
      <PageHeader
        title="Jobs pipeline"
        subtitle="Every role you're considering, from saved to offer. Drag cards between stages."
        action={
          <div className="flex gap-2">
            {unscored > 0 && (
              <Button variant="ghost" onClick={scoreAll} disabled={queueing || scoring.length > 0}>
                {queueing || scoring.length ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {scoring.length ? `Scoring ${scoring.length}…` : `Score ${unscored} ${unscored === 1 ? "job" : "jobs"}`}
              </Button>
            )}
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add job
            </Button>
          </div>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-wing/5 px-3 py-2 text-sm text-wing">{notice}</p>}

      <JobInbox jobs={inbox} onSave={saveFromInbox} onDismiss={(j) => move(j.id, "dismissed")} />

      {jobs.length === inbox.length ? (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="No jobs yet"
          body="Add roles you've found or applied to, save them from your inbox, or save them from LinkedIn with the Offerwing extension."
          action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add your first job</Button>}
        />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="grid min-w-[1100px] grid-cols-5 gap-4">
            {OPEN_STAGES.map((stage) => {
              const meta = STAGES.find((s) => s.id === stage)!;
              const items = jobs.filter((j) => j.stage === stage);
              return (
                <section
                  key={stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(stage);
                  }}
                  onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                  onDrop={(e) => {
                    setDragOver(null);
                    const id = e.dataTransfer.getData("text/job-id");
                    if (id) move(id, stage);
                  }}
                  className={`flex min-h-[420px] flex-col rounded-3xl p-3 transition-colors ${dragOver === stage ? "bg-wing/10 ring-2 ring-wing/40" : "bg-white/60"}`}
                  aria-label={`${meta.label} column`}
                >
                  <header className="mb-3 flex items-center gap-2 px-1">
                    <span className={`size-2 rounded-full ${meta.color}`} />
                    <h2 className="text-sm font-semibold">{meta.label}</h2>
                    <span className="text-xs text-muted">{items.length}</span>
                  </header>
                  <div className="flex flex-1 flex-col gap-2">
                    {items.map((j) => (
                      <JobCard key={j.id} job={j} contacts={contactsAt(j.company)} scoring={scoring.includes(j.id)} onOpen={() => openJob(j)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowClosed(!showClosed)} className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground">
            <ChevronDown className={`size-4 transition-transform ${showClosed ? "" : "-rotate-90"}`} />
            Closed ({closed.length})
          </button>
          {showClosed && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {closed.map((j) => (
                <JobCard key={j.id} job={j} contacts={contactsAt(j.company)} scoring={scoring.includes(j.id)} onOpen={() => openJob(j)} />
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a job" : "Edit job"}>
        {editing !== null && editing !== "new" && (
          <>
            <JobMatchPanel job={jobs.find((j) => j.id === editing.id) ?? editing} run={matchRun} onRefresh={refreshMatch} />
            <Link href={`/dashboard/jobs/${editing.id}/kit`} className="mb-6 flex items-center justify-between rounded-3xl bg-ink p-5 text-white hover:bg-ink/90">
              <span>
                <span className="block font-semibold">Application kit</span>
                <span className="block text-sm text-white/60">Tailored resume, cover note and screening answers</span>
              </span>
              <ArrowRight className="size-5 text-wing-soft" />
            </Link>
          </>
        )}
        {editing !== null && (
          <JobForm
            key={editing === "new" ? "new" : editing.id}
            job={editing === "new" ? undefined : editing}
            onSaved={(j) => {
              const isNew = editing === "new";
              upsert(j);
              setEditing(null);
              // New jobs with a description get scored automatically.
              if (isNew && j.description) {
                void startJobMatches([j.id]).then(async (r) => {
                  if (r.error) setError(`Added, but couldn't score it: ${r.error}`);
                  else if (r.queued) setScoring((await getScoringStatus()).running);
                });
              }
            }}
            onDeleted={(id) => {
              setJobs((all) => all.filter((x) => x.id !== id));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
