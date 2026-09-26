import { ArrowRight, CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Offers } from "@/components/dashboard/Offers";
import { StoryBank } from "@/components/dashboard/StoryBank";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { STORY_COLUMNS, type Story } from "@/lib/agents/interviews";
import { OFFER_COLUMNS, type Offer } from "@/lib/agents/negotiation";
import { requireUser } from "@/lib/auth";
import { OPEN_STAGES, STAGES } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Interviews & offers · Offerwing" };

// Story extraction and negotiation plans call the AI model from server actions on this route.
export const maxDuration = 120;

export default async function InterviewsPage() {
  const { supabase } = await requireUser();
  const [{ data: stories }, { data: jobs }, { data: offers }, { data: preps }, { count: docCount }] = await Promise.all([
    supabase.from("stories").select(STORY_COLUMNS).order("created_at"),
    supabase.from("jobs").select("id, title, company, stage").in("stage", OPEN_STAGES),
    supabase.from("offers").select(OFFER_COLUMNS).order("created_at"),
    supabase.from("interview_preps").select("job_id, status, created_at").eq("status", "complete"),
    supabase.from("career_documents").select("id", { count: "exact", head: true }).in("kind", ["resume", "linkedin_pdf"]),
  ]);
  const interviewing = (jobs ?? []).filter((j) => j.stage === "screen" || j.stage === "interview");
  const prepped = new Set((preps ?? []).map((p) => p.job_id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Interviews & offers" subtitle="Prep for every round, practice your answers and negotiate with confidence." />
      <div className="space-y-6">
        <Card>
          <h2 className="flex items-center gap-2 font-semibold"><CalendarCheck className="size-4 text-wing" /> Upcoming interviews</h2>
          {interviewing.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Move a job to Screen or Interviewing in your <Link href="/dashboard/jobs" className="font-medium text-wing hover:underline">pipeline</Link> and it shows up here with a prep pack.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {interviewing.map((j) => (
                <li key={j.id}>
                  <Link href={`/dashboard/interviews/${j.id}`} className="flex items-center gap-3 py-3 hover:text-wing">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{j.title}</span>
                      <span className="block truncate text-sm text-muted">{j.company} · {STAGES.find((s) => s.id === j.stage)?.label}</span>
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${prepped.has(j.id) ? "bg-emerald-50 text-emerald-700" : "bg-card text-muted"}`}>{prepped.has(j.id) ? "Prep ready" : "Prepare"}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <StoryBank stories={(stories ?? []) as Story[]} hasDocuments={(docCount ?? 0) > 0} />
        <Offers offers={(offers ?? []) as Offer[]} jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title, company: j.company }))} />
      </div>
    </div>
  );
}
