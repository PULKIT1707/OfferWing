"use client";

import { Check, Download, Loader2, TriangleAlert } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { deleteAccount } from "@/app/dashboard/actions";
import { inputClass } from "@/components/onboarding/fields";
import { AiStep, DocumentsStep } from "@/components/onboarding/steps-setup";
import { CareerStep, LinkedinStep, PreferencesStep } from "@/components/onboarding/steps-profile";
import type { ApplicationProfile } from "@/lib/application-profile";
import type { AiSettings, CareerDocument, SearchProfile } from "@/lib/onboarding";
import { ApplicationProfileForm } from "./ApplicationProfileForm";
import { SponsorSettings, type SponsorMembership } from "./SponsorSettings";
import { JobSources, type InboundEmailRow, type JobSource } from "./JobSources";
import { Button } from "./ui";

function Section({ id, title, subtitle, saved, children }: { id: string; title: string; subtitle: string; saved?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl bg-white p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        {saved && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700" role="status">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function useSavedFlag() {
  const [saved, setSaved] = useState<string | null>(null);
  const flag = (id: string) => {
    setSaved(id);
    setTimeout(() => setSaved((s) => (s === id ? null : s)), 2500);
  };
  return { saved, flag };
}

function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <p className="flex items-center gap-2 font-medium text-red-700">
        <TriangleAlert className="size-4" /> Delete account
      </p>
      <p className="mt-1 text-sm text-muted">Permanently deletes your account, answers, files, jobs, contacts and stored AI key. This can&apos;t be undone.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type DELETE to confirm" className={`${inputClass} sm:max-w-xs`} aria-label="Type DELETE to confirm" />
        <Button
          variant="danger"
          disabled={pending || confirm !== "DELETE"}
          onClick={() =>
            start(async () => {
              const r = await deleteAccount(confirm);
              if (r && !r.ok) setError(r.error);
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Delete my account
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function SettingsView({
  userId,
  profile: initialProfile,
  ai: initialAi,
  documents: initialDocs,
  alertAddress,
  jobSources,
  inboundEmails,
  application,
  sponsorships,
}: {
  userId: string;
  profile: SearchProfile;
  ai: AiSettings;
  documents: CareerDocument[];
  alertAddress: string;
  jobSources: JobSource[];
  inboundEmails: InboundEmailRow[];
  application: ApplicationProfile;
  sponsorships: SponsorMembership[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [ai, setAi] = useState(initialAi);
  const [docs, setDocs] = useState(initialDocs);
  const { saved, flag } = useSavedFlag();
  const onProfile = (id: string) => (patch?: Partial<SearchProfile>) => {
    if (patch) setProfile((p) => ({ ...p, ...patch }));
    flag(id);
  };

  const nav = [
    ["#search", "Job search"],
    ...(sponsorships.length ? [["#sponsor", "Program"]] : []),
    ["#linkedin", "LinkedIn"],
    ["#applications", "Applications"],
    ["#sources", "Job sources"],
    ["#ai", "AI & keys"],
    ["#documents", "Documents"],
    ["#privacy", "Privacy"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="headline text-3xl font-semibold sm:text-4xl">Settings</h1>
      <p className="mt-2 text-muted">Change anything you told us during setup. Your agents re-plan when you do.</p>
      <nav className="sticky top-14 z-10 -mx-4 mt-6 flex gap-1 overflow-x-auto bg-card/90 px-4 py-2 backdrop-blur lg:top-0">
        {nav.map(([href, l]) => (
          <a key={href} href={href} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-white hover:text-foreground">
            {l}
          </a>
        ))}
      </nav>

      <div className="mt-4 space-y-6">
        <Section id="search" title="Goals" subtitle="Target roles, seniority and search mode." saved={saved === "career"}>
          <CareerStep embedded profile={profile} onDone={onProfile("career")} />
        </Section>
        <Section id="preferences" title="Preferences" subtitle="Location, work mode, salary and daily time." saved={saved === "preferences"}>
          <PreferencesStep embedded profile={profile} onDone={onProfile("preferences")} />
        </Section>
        <Section id="linkedin" title="LinkedIn" subtitle="Your plan, target companies and writing samples." saved={saved === "linkedin"}>
          <LinkedinStep embedded profile={profile} onDone={onProfile("linkedin")} />
        </Section>
        <Section id="applications" title="Application details" subtitle="What job application forms ask for. The extension fills these in; you review and submit." saved={saved === "applications"}>
          <ApplicationProfileForm initial={application} onSaved={() => flag("applications")} />
        </Section>
        <Section id="sources" title="Job sources" subtitle="Where new jobs come from. Everything lands in your pipeline inbox.">
          <JobSources alertAddress={alertAddress} sources={jobSources} emails={inboundEmails} />
        </Section>
        <Section
          id="ai"
          title="AI & keys"
          subtitle={
            ai.mode === "cloud"
              ? `Always-on · ${ai.provider} key ending …${ai.key_last4}`
              : ai.mode === "private"
                ? `Private · ${ai.provider} key kept in your browser extension`
                : "Starter · running on Offerwing credits"
          }
          saved={saved === "ai"}
        >
          <AiStep embedded ai={ai} onAi={setAi} onDone={() => flag("ai")} />
        </Section>
        {sponsorships.length > 0 && (
          <Section id="sponsor" title="Outplacement program" subtitle="An employer is supporting your job search.">
            <SponsorSettings memberships={sponsorships} />
          </Section>
        )}
        <Section id="documents" title="Documents" subtitle="Your resume and LinkedIn files. Changes save instantly.">
          <DocumentsStep embedded userId={userId} documents={docs} onDocuments={setDocs} onDone={() => {}} />
        </Section>
        <Section id="privacy" title="Privacy & data" subtitle="Your data is yours. Take it with you or delete it.">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-line p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Export your data</p>
                <p className="mt-1 text-sm text-muted">Download everything as JSON: answers, jobs, contacts and document list.</p>
              </div>
              <a href="/api/export" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:border-wing hover:text-wing">
                <Download className="size-4" /> Export
              </a>
            </div>
            <DangerZone />
          </div>
        </Section>
      </div>
    </div>
  );
}
