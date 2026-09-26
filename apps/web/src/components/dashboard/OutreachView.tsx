"use client";

import { Check, ChevronDown, Clock, ExternalLink, Loader2, MessageSquare, Send, Sparkles, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { draftOutreach, markDraftSent, markReplied, stopFollowUps } from "@/app/dashboard/outreach/actions";
import { MAX_FOLLOW_UPS, WEEKLY_INVITE_BUDGET, type OutreachDraft, type OutreachKind } from "@/lib/agents/outreach";
import { daysSince, labelOf, REFERRAL_STATUSES, RELATIONSHIPS, sameCompany, today, type Contact } from "@/lib/dashboard";
import { CopyButton } from "./CopyButton";
import { Button, Card, EmptyState, Modal, PageHeader } from "./ui";

export type OutreachContact = Contact & { follow_ups_sent: number };
export type DraftRow = { id: string; kind: OutreachKind; result: OutreachDraft; sent_at: string | null; created_at: string; contact_id: string | null; contacts: { full_name: string } | null };
type JobOption = { id: string; title: string; company: string };

const KIND_LABEL: Record<OutreachKind, string> = { referral_ask: "Referral ask", follow_up: "Follow-up", connection_note: "Connection note" };

function DraftModal({ contact, kind, jobs, onClose }: { contact: OutreachContact; kind: OutreachKind; jobs: JobOption[]; onClose: () => void }) {
  const router = useRouter();
  const companyJobs = jobs.filter((j) => sameCompany(j.company, contact.company));
  const [jobId, setJobId] = useState<string | null>(contact.job_id ?? companyJobs[0]?.id ?? null);
  const [draft, setDraft] = useState<OutreachDraft>();
  const [draftId, setDraftId] = useState<string>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(undefined);
      const r = await draftOutreach(contact.id, kind, jobId);
      if (r.error) setError(r.error);
      else {
        setDraft(r.draft);
        setDraftId(r.draftId);
      }
    });

  return (
    <Modal open onClose={onClose} title={`${KIND_LABEL[kind]} · ${contact.full_name}`}>
      <div className="space-y-4">
        {kind !== "connection_note" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="o-job">About</label>
            <select id="o-job" className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" value={jobId ?? ""} onChange={(e) => { setJobId(e.target.value || null); setDraft(undefined); }}>
              {companyJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              <option value="">No specific role</option>
            </select>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {!draft ? (
          <Button onClick={generate} disabled={pending} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {pending ? "Writing…" : "Write the draft"}
          </Button>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{kind === "connection_note" ? `Note · ${draft.message.length}/300` : "Message"}</p>
                <CopyButton text={draft.message} />
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{draft.message}</p>
            </div>
            {kind !== "connection_note" && (
              <div className="rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Short version · {draft.short_version.length}/300</p>
                  <CopyButton text={draft.short_version} />
                </div>
                <p className="mt-2 text-sm">{draft.short_version}</p>
              </div>
            )}
            {draft.tips.length > 0 && <ul className="space-y-1 text-xs text-muted">{draft.tips.map((t) => <li key={t}>💡 {t}</li>)}</ul>}
            <div className="flex flex-col gap-2 sm:flex-row">
              {contact.linkedin_url && (
                <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:border-wing hover:text-wing">
                  <ExternalLink className="size-4" /> Open their LinkedIn
                </a>
              )}
              {sent ? (
                <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                  <Check className="size-4" /> Recorded
                </span>
              ) : (
                <Button
                  className="flex-1"
                  disabled={pending || !draftId}
                  onClick={() =>
                    start(async () => {
                      const r = await markDraftSent(draftId!);
                      if (r.error) setError(r.error);
                      else {
                        setSent(true);
                        router.refresh();
                      }
                    })
                  }
                >
                  <Send className="size-4" /> I sent it
                </Button>
              )}
            </div>
            <button onClick={generate} disabled={pending} className="w-full text-center text-xs text-muted hover:text-wing">Rewrite</button>
          </>
        )}
        <p className="text-xs text-muted">Offerwing never sends messages for you. Copy the draft, send it on LinkedIn yourself, then tap &ldquo;I sent it&rdquo;.</p>
      </div>
    </Modal>
  );
}

function PersonCard({ c, children, note }: { c: OutreachContact; children: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{c.full_name}</p>
        <p className="truncate text-sm text-muted">{[c.title, c.company].filter(Boolean).join(" · ")}</p>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function RepliedMenu({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const pick = (o: "agreed" | "referred" | "declined" | null) =>
    start(async () => {
      await markReplied(contactId, o);
      setOpen(false);
      router.refresh();
    });
  return (
    <div className="relative">
      <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setOpen(!open)} disabled={pending}>
        They replied <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl bg-white text-sm shadow-lg ring-1 ring-line">
          {([["agreed", "Agreed to refer"], ["referred", "Referred me"], ["declined", "Said no"], [null, "Just replied"]] as const).map(([o, l]) => (
            <button key={l} onClick={() => pick(o)} className="block w-full px-3 py-2 text-left hover:bg-card">{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OutreachView({ contacts, jobs, drafts, invitesThisWeek }: { contacts: OutreachContact[]; jobs: JobOption[]; drafts: DraftRow[]; invitesThisWeek: number }) {
  const router = useRouter();
  const [drafting, setDrafting] = useState<{ contact: OutreachContact; kind: OutreachKind } | null>(null);
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = today();

  const due = contacts.filter((c) => c.next_follow_up_at && c.next_follow_up_at <= now).sort((a, b) => a.next_follow_up_at!.localeCompare(b.next_follow_up_at!));
  const toAsk = contacts.filter((c) => c.referral_status === "to_ask" && !c.last_contacted_at);
  const toConnect = contacts.filter((c) => ["recruiter", "hiring_manager", "mutual"].includes(c.relationship) && c.referral_status === "none" && !c.last_contacted_at);
  const budgetPct = Math.min(100, Math.round((invitesThisWeek / WEEKLY_INVITE_BUDGET) * 100));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Outreach" subtitle="Referral asks, follow-ups and connection notes. You send everything yourself; Offerwing drafts and keeps track." />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <p className="text-sm font-medium">Connection invites this week</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 rounded-full bg-card">
              <div className={`h-full rounded-full ${budgetPct >= 90 ? "bg-amber-500" : "bg-wing"}`} style={{ width: `${budgetPct}%` }} />
            </div>
            <span className="text-sm font-semibold">{invitesThisWeek}/{WEEKLY_INVITE_BUDGET}</span>
          </div>
          <p className="mt-2 text-xs text-muted">LinkedIn limits invitations to about 100 a week. Staying under {WEEKLY_INVITE_BUDGET} keeps your account in good standing.</p>
        </Card>
        <Card>
          <p className="text-sm font-medium">Follow-ups due</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{due.length}</p>
        </Card>
      </div>

      {contacts.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="No one on your list yet" body="Add people from Referral Scout or the extension, then draft and track your outreach here." />
      ) : (
        <div className="space-y-6">
          <Card>
            <h2 className="flex items-center gap-2 font-semibold"><Clock className="size-4 text-wing" /> Follow-ups due</h2>
            {due.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing due. When you send a referral ask, a follow-up is scheduled {5} days later.</p>
            ) : (
              <div className="mt-2">
                {due.map((c) => (
                  <PersonCard
                    key={c.id}
                    c={c}
                    note={
                      <>
                        {c.next_follow_up_at! < now ? <span className="font-medium text-red-600">Overdue · </span> : null}
                        {labelOf(REFERRAL_STATUSES, c.referral_status)}
                        {c.last_contacted_at ? ` · last contacted ${daysSince(c.last_contacted_at)}d ago` : ""}
                        {` · follow-up ${Math.min(c.follow_ups_sent + 1, MAX_FOLLOW_UPS)} of ${MAX_FOLLOW_UPS}`}
                      </>
                    }
                  >
                    <RepliedMenu contactId={c.id} />
                    <Button variant="ghost" className="px-3 py-2 text-xs" disabled={pending} onClick={() => start(async () => { await stopFollowUps(c.id); router.refresh(); })}>Stop</Button>
                    {c.follow_ups_sent < MAX_FOLLOW_UPS && (
                      <Button className="px-3 py-2 text-xs" onClick={() => setDrafting({ contact: c, kind: "follow_up" })}><Sparkles className="size-3.5" /> Draft follow-up</Button>
                    )}
                  </PersonCard>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="size-4 text-wing" /> Ready to ask for a referral</h2>
            {toAsk.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Mark people as &ldquo;To ask&rdquo; in Referrals &amp; network and they show up here.</p>
            ) : (
              <div className="mt-2">
                {toAsk.map((c) => (
                  <PersonCard key={c.id} c={c} note={labelOf(RELATIONSHIPS, c.relationship)}>
                    <Button className="px-3 py-2 text-xs" onClick={() => setDrafting({ contact: c, kind: "referral_ask" })}><Sparkles className="size-3.5" /> Draft referral ask</Button>
                  </PersonCard>
                ))}
              </div>
            )}
          </Card>

          {toConnect.length > 0 && (
            <Card>
              <h2 className="flex items-center gap-2 font-semibold"><UserPlus className="size-4 text-wing" /> Recruiters and hiring managers to connect with</h2>
              <div className="mt-2">
                {toConnect.map((c) => (
                  <PersonCard key={c.id} c={c} note={labelOf(RELATIONSHIPS, c.relationship)}>
                    <Button className="px-3 py-2 text-xs" onClick={() => setDrafting({ contact: c, kind: "connection_note" })}><Sparkles className="size-3.5" /> Draft connection note</Button>
                  </PersonCard>
                ))}
              </div>
            </Card>
          )}

          {drafts.length > 0 && (
            <Card>
              <h2 className="font-semibold">Recent drafts</h2>
              <ul className="mt-2 divide-y divide-line">
                {drafts.map((d) => (
                  <li key={d.id} className="py-3">
                    <button onClick={() => setOpenDraft(openDraft === d.id ? null : d.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={openDraft === d.id}>
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted">{KIND_LABEL[d.kind]}</span>
                      <span className="flex-1 truncate text-sm font-medium">{d.contacts?.full_name ?? "Someone"}</span>
                      <span className={`text-xs ${d.sent_at ? "text-emerald-700" : "text-muted"}`}>{d.sent_at ? "Sent" : "Not sent"}</span>
                      <ChevronDown className={`size-4 text-muted transition-transform ${openDraft === d.id ? "rotate-180" : ""}`} />
                    </button>
                    {openDraft === d.id && (
                      <div className="mt-3 rounded-2xl bg-card p-4">
                        <div className="flex justify-end gap-2">
                          <CopyButton text={d.result.message} />
                          {!d.sent_at && (
                            <Button variant="ghost" className="px-2.5 py-1.5 text-xs" disabled={pending} onClick={() => start(async () => { await markDraftSent(d.id); router.refresh(); })}>
                              <Send className="size-3.5" /> I sent it
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm">{d.result.message}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {drafting && <DraftModal contact={drafting.contact} kind={drafting.kind} jobs={jobs} onClose={() => { setDrafting(null); router.refresh(); }} />}
    </div>
  );
}
