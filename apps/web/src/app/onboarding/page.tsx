import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wizard } from "@/components/onboarding/Wizard";
import { ALERT_DOMAIN } from "@/lib/discovery";
import { LEGACY_STEPS, STEPS, withDefaults, type AiSettings, type CareerDocument, type StepId } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up · Offerwing" };

// Continuing past the resume step reads it with AI (server action on this route).
export const maxDuration = 60;

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: search }, { data: ai }, { data: docs }] = await Promise.all([
    supabase.from("profiles").select("full_name, alert_alias, onboarding_step").eq("id", userId).single(),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_settings").select("mode, provider, key_last4").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("id, kind, file_name, size_bytes").eq("user_id", userId).order("created_at"),
  ]);

  if (!profile) redirect("/login");
  if (profile.onboarding_step === "done") redirect("/dashboard");

  const saved = LEGACY_STEPS[profile.onboarding_step] ?? profile.onboarding_step;
  const step = (STEPS.some((s) => s.id === saved) ? saved : STEPS[0].id) as StepId;
  const initialProfile = withDefaults(search);

  return (
    <Wizard
      userId={userId}
      firstName={profile.full_name?.split(" ")[0] ?? null}
      alertAddress={`${profile.alert_alias}@${ALERT_DOMAIN()}`}
      initialStep={step}
      initialProfile={initialProfile}
      initialAi={(ai ?? { mode: "starter", provider: null, key_last4: null }) as AiSettings}
      initialDocuments={(docs ?? []) as CareerDocument[]}
    />
  );
}
