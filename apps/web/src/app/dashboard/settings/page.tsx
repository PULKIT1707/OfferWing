import type { Metadata } from "next";
import { SettingsView } from "@/components/dashboard/SettingsView";
import { requireUser } from "@/lib/auth";
import { withDefaults, type AiSettings, type CareerDocument } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Settings · Offerwing" };

export default async function SettingsPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: search }, { data: ai }, { data: docs }] = await Promise.all([
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_settings").select("mode, provider, key_last4").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("id, kind, file_name, size_bytes").order("created_at"),
  ]);
  return (
    <SettingsView
      userId={userId}
      profile={withDefaults(search)}
      ai={(ai ?? { mode: "starter", provider: null, key_last4: null }) as AiSettings}
      documents={(docs ?? []) as CareerDocument[]}
    />
  );
}
