import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitView, type KitRun } from "@/components/dashboard/KitView";
import { isKitRunning } from "@/lib/agents/application-tailor";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Application kit · Offerwing" };

// Tailoring runs in after() on this route.
export const maxDuration = 300;

export default async function KitPage(props: PageProps<"/dashboard/jobs/[id]/kit">) {
  const { id } = await props.params;
  const { supabase } = await requireUser();
  const [{ data: job }, { data: run }] = await Promise.all([
    supabase.from("jobs").select("id, title, company, description").eq("id", id).maybeSingle(),
    supabase
      .from("application_kits")
      .select("id, status, model, result, verification, error, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!job) notFound();

  return (
    <KitView
      job={{ id: job.id, title: job.title, company: job.company, hasDescription: !!job.description?.trim() }}
      run={(run ?? null) as KitRun | null}
      running={isKitRunning(run)}
    />
  );
}
