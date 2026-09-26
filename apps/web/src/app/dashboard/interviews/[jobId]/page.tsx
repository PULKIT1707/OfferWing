import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrepView, type PracticeRow, type PrepRun } from "@/components/dashboard/PrepView";
import { isPrepRunning } from "@/lib/agents/interviews";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Interview prep · Offerwing" };

// The prep pack runs in after() and practice feedback in a server action on this route.
export const maxDuration = 300;

export default async function PrepPage(props: PageProps<"/dashboard/interviews/[jobId]">) {
  const { jobId } = await props.params;
  const { supabase } = await requireUser();
  const [{ data: job }, { data: run }, { data: history }, { count: storyCount }] = await Promise.all([
    supabase.from("jobs").select("id, title, company, description").eq("id", jobId).maybeSingle(),
    supabase.from("interview_preps").select("id, status, round, interviewer_notes, researched, model, result, error, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("practice_answers").select("id, question, answer, feedback, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(20),
    supabase.from("stories").select("id", { count: "exact", head: true }),
  ]);
  if (!job) notFound();
  return (
    <PrepView
      job={{ id: job.id, title: job.title, company: job.company, hasDescription: !!job.description?.trim() }}
      run={(run ?? null) as PrepRun | null}
      running={isPrepRunning(run)}
      history={(history ?? []) as PracticeRow[]}
      storyCount={storyCount ?? 0}
    />
  );
}
