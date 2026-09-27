"use client";

import { Building2, ExternalLink, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { labelOf, OPEN_STAGES, REFERRAL_STATUSES, RELATIONSHIPS, sameCompany, today, type Contact, type Job } from "@/lib/dashboard";
import { ContactForm } from "./ContactForm";
import { PacketList, type PacketSummary } from "./PacketList";
import { ReferralScout, type ScoutState } from "./ReferralScout";
import { Button, Card, EmptyState, Modal, PageHeader } from "./ui";

const STATUS_STYLE: Record<Contact["referral_status"], string> = {
  none: "bg-card text-muted",
  to_ask: "bg-amber-100 text-amber-800",
  asked: "bg-sky-100 text-sky-800",
  agreed: "bg-wing/10 text-wing",
  referred: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-700",
};

// Higher = better person to ask for a referral.
const RELATIONSHIP_WEIGHT: Record<Contact["relationship"], number> = {
  ex_colleague: 3, connection: 2, alumni: 2, hiring_manager: 2, recruiter: 1, mutual: 1, other: 0,
};
const rank = (c: Contact) => c.strength * 2 + RELATIONSHIP_WEIGHT[c.relationship];

export function NetworkView({ initialContacts, jobs, dreamCompanies, scout, packets }: { initialContacts: Contact[]; jobs: Job[]; dreamCompanies: string[]; scout: ScoutState; packets: PacketSummary[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  // Adopt fresh server data (e.g. after Referral Scout adds someone) while keeping local edits snappy.
  const [prevInitial, setPrevInitial] = useState(initialContacts);
  if (initialContacts !== prevInitial) {
    setPrevInitial(initialContacts);
    setContacts(initialContacts);
  }
  const [editing, setEditing] = useState<Contact | { company?: string } | null>(null);
  const [query, setQuery] = useState("");

  const upsert = (c: Contact) => setContacts((all) => (all.some((x) => x.id === c.id) ? all.map((x) => (x.id === c.id ? c : x)) : [c, ...all]));

  // Companies you're targeting: dream companies plus companies with open jobs.
  const targets = useMemo(() => {
    const names = [...dreamCompanies, ...jobs.filter((j) => OPEN_STAGES.includes(j.stage)).map((j) => j.company)];
    const unique = names.filter((n, i) => names.findIndex((m) => sameCompany(m, n)) === i);
    return unique.map((company) => {
      const people = contacts.filter((c) => sameCompany(c.company, company)).sort((a, b) => rank(b) - rank(a));
      const openJobs = jobs.filter((j) => sameCompany(j.company, company) && OPEN_STAGES.includes(j.stage)).length;
      return { company, people, openJobs };
    });
  }, [contacts, jobs, dreamCompanies]);

  const filtered = contacts.filter((c) => [c.full_name, c.company, c.title].some((f) => f?.toLowerCase().includes(query.toLowerCase())));
  const groups = Object.entries(
    filtered.reduce<Record<string, Contact[]>>((acc, c) => {
      const key = c.company?.trim() || "No company";
      (acc[key] ??= []).push(c);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <PageHeader
        title="Referrals & network"
        subtitle="The people who can get you in the door, organized by company."
        action={<Button onClick={() => setEditing({})}><Plus className="size-4" /> Add person</Button>}
      />

      <ReferralScout state={scout} />
      <PacketList packets={packets} />

      {targets.length > 0 && scout.lastImport?.status !== "complete" && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Target companies</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {targets.map(({ company, people, openJobs }) => {
              const best = people[0];
              return (
                <Card key={company} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-wing" />
                      <p className="font-semibold">{company}</p>
                    </div>
                    {openJobs > 0 && <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted">{openJobs} open {openJobs === 1 ? "job" : "jobs"}</span>}
                  </div>
                  {best ? (
                    <div className="mt-4 flex-1">
                      <p className="text-xs text-muted">Best person to ask</p>
                      <button onClick={() => setEditing(best)} className="mt-1 text-left">
                        <span className="font-medium hover:text-wing">{best.full_name}</span>
                        <span className="block text-xs text-muted">{labelOf(RELATIONSHIPS, best.relationship)}{best.title ? ` · ${best.title}` : ""}</span>
                      </button>
                      {people.length > 1 && <p className="mt-2 text-xs text-muted">+{people.length - 1} more you know here</p>}
                    </div>
                  ) : (
                    <p className="mt-4 flex-1 text-sm text-muted">No one yet. Check your connections, alumni and ex-colleagues here.</p>
                  )}
                  <Button variant="ghost" className="mt-4" onClick={() => setEditing({ company })}>
                    <Plus className="size-4" /> Add someone at {company}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your referral list ({contacts.length})</h2>
          {contacts.length > 0 && (
            <label className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 sm:w-72">
              <Search className="size-4 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people or companies" className="flex-1 bg-transparent text-sm outline-none" />
            </label>
          )}
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Add the people you know"
            body="Start with ex-colleagues, alumni and connections at your target companies. When you upload your LinkedIn data export, Referral Scout will map these automatically."
            action={<Button onClick={() => setEditing({})}><Plus className="size-4" /> Add person</Button>}
          />
        ) : (
          <div className="space-y-6">
            {groups.map(([company, people]) => (
              <div key={company}>
                <p className="mb-2 text-sm font-medium">{company}</p>
                <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                  {people.map((c) => {
                    const followUpDue = c.next_follow_up_at && c.next_follow_up_at <= today();
                    return (
                      <div key={c.id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
                        <button onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                          <p className="truncate font-medium hover:text-wing">{c.full_name}</p>
                          <p className="truncate text-xs text-muted">
                            {labelOf(RELATIONSHIPS, c.relationship)}
                            {c.title ? ` · ${c.title}` : ""}
                            {followUpDue ? " · " : ""}
                            {followUpDue && <span className="font-medium text-red-600">Follow up due</span>}
                          </p>
                        </button>
                        <span className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${STATUS_STYLE[c.referral_status]}`}>
                          {c.referral_status === "none" ? "Contact" : labelOf(REFERRAL_STATUSES, c.referral_status)}
                        </span>
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noreferrer" aria-label={`Open ${c.full_name}'s LinkedIn`} className="text-muted hover:text-wing">
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && "id" in editing ? "Edit person" : "Add a person"}>
        {editing !== null && (
          <ContactForm
            key={"id" in editing ? editing.id : `new-${editing.company ?? ""}`}
            contact={"id" in editing ? editing : undefined}
            defaultCompany={"id" in editing ? undefined : editing.company}
            jobs={jobs}
            onSaved={(c) => {
              upsert(c);
              setEditing(null);
            }}
            onDeleted={(id) => {
              setContacts((all) => all.filter((x) => x.id !== id));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
