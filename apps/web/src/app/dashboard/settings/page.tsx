import type { Metadata } from "next";
import type { InboundEmailRow, JobSource } from "@/components/dashboard/JobSources";
import { SettingsView } from "@/components/dashboard/SettingsView";
import { ALERT_DOMAIN } from "@/lib/discovery";
import { requireUser } from "@/lib/auth";
import { withDefaults, type AiSettings, type CareerDocument } from "@/lib/onboarding";

export const metadata: Metadata = { title: "Settings · Offerwing" };

// Following a careers page fetches it right away.
export const maxDuration = 60;

export default async function SettingsPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: search }, { data: ai }, { data: docs }, { data: profile }, { data: sources }, { data: emails }] = await Promise.all([
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_settings").select("mode, provider, key_last4").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("id, kind, file_name, size_bytes").order("created_at"),
    supabase.from("profiles").select("alert_alias").eq("id", userId).single(),
    supabase.from("job_sources").select("id, kind, board_token, company_name, only_matching, last_checked_at, last_found, last_error").order("company_name"),
    supabase.from("inbound_emails").select("id, from_address, subject, kind, jobs_found, detail, received_at").order("received_at", { ascending: false }).limit(10),
  ]);
  return (
    <SettingsView
      userId={userId}
      profile={withDefaults(search)}
      ai={(ai ?? { mode: "starter", provider: null, key_last4: null }) as AiSettings}
      documents={(docs ?? []) as CareerDocument[]}
      alertAddress={`${profile?.alert_alias}@${ALERT_DOMAIN()}`}
      jobSources={(sources ?? []) as JobSource[]}
      inboundEmails={(emails ?? []) as InboundEmailRow[]}
    />
  );
}
