import type { Metadata } from "next";
import { JobsBoard } from "@/components/dashboard/JobsBoard";
import { requireUser } from "@/lib/auth";
import { CONTACT_COLUMNS, JOB_COLUMNS, type Contact, type Job } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Jobs pipeline · Offerwing" };

// Fit scoring runs in after() on this route.
export const maxDuration = 300;

export default async function JobsPage() {
  const { supabase } = await requireUser();
  const [{ data: jobs }, { data: contacts }] = await Promise.all([
    supabase.from("jobs").select(JOB_COLUMNS).order("updated_at", { ascending: false }),
    supabase.from("contacts").select(CONTACT_COLUMNS),
  ]);
  return <JobsBoard initialJobs={(jobs ?? []) as Job[]} contacts={(contacts ?? []) as Contact[]} />;
}
