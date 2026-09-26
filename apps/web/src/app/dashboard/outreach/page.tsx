import type { Metadata } from "next";
import { OutreachView, type DraftRow, type OutreachContact } from "@/components/dashboard/OutreachView";
import { requireUser } from "@/lib/auth";
import { CONTACT_COLUMNS, OPEN_STAGES } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Outreach · Offerwing" };

// Drafting calls the AI model from a server action on this route.
export const maxDuration = 60;

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

export default async function OutreachPage() {
  const { supabase } = await requireUser();
  const [{ data: contacts }, { data: jobs }, { data: drafts }, { count: invites }] = await Promise.all([
    supabase.from("contacts").select(`${CONTACT_COLUMNS}, follow_ups_sent`).order("full_name"),
    supabase.from("jobs").select("id, title, company").in("stage", OPEN_STAGES),
    supabase.from("outreach_drafts").select("id, kind, result, sent_at, created_at, contact_id, contacts(full_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("outreach_drafts").select("id", { count: "exact", head: true }).eq("kind", "connection_note").gte("sent_at", startOfWeek().toISOString()),
  ]);
  return (
    <OutreachView
      contacts={(contacts ?? []) as OutreachContact[]}
      jobs={jobs ?? []}
      drafts={(drafts ?? []) as unknown as DraftRow[]}
      invitesThisWeek={invites ?? 0}
    />
  );
}
