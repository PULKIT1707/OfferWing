import type { Metadata } from "next";
import { TalentView, type IntroForMe, type TalentRow } from "@/components/dashboard/TalentView";
import { isTalentGenerating } from "@/lib/agents/talent-profile";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Get discovered · Offerwing" };

// Building the profile runs in after() from a server action on this route.
export const maxDuration = 300;

export default async function TalentPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: talent }, { data: intros }] = await Promise.all([
    supabase
      .from("talent_profiles")
      .select("public_id, visible, status, headline, summary, roles, seniority, years_experience, industries, locations, work_modes, open_to_relocate, needs_sponsorship, salary_min, salary_currency, skills, highlights, availability, hidden_companies, verification, error, published_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("my_intro_requests"),
  ]);
  return <TalentView talent={(talent ?? null) as TalentRow | null} generating={isTalentGenerating(talent)} intros={(intros ?? []) as IntroForMe[]} />;
}
