"use server";

import { revalidatePath } from "next/cache";
import type { JobMatch } from "@/lib/agents/job-match";
import { buildOutreachPrompt, FOLLOW_UP_AFTER_DAYS, MAX_FOLLOW_UPS, OUTREACH_SYSTEM, outreachDraftSchema, STARTER_DAILY_DRAFTS, type OutreachDraft, type OutreachKind } from "@/lib/agents/outreach";
import { CONNECTION_COLUMNS, scoreConnection, type Connection } from "@/lib/agents/referral-scout";
import { requireUser } from "@/lib/auth";
import { CONTACT_COLUMNS, daysSince, labelOf, RELATIONSHIPS, type Contact } from "@/lib/dashboard";
import { resolveCredential } from "@/lib/llm/credentials";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { starterRunsLeft } from "@/lib/llm/quota";
import { withDefaults } from "@/lib/onboarding";
import { dateInZone } from "@/lib/time";
import { userTimeZone } from "@/lib/user-time";
import { loadScoringContext } from "@/lib/referrals";

// Writes a referral ask, follow-up or connection note for someone on the user's list.
export async function draftOutreach(contactId: string, kind: OutreachKind, jobId: string | null): Promise<{ draft?: OutreachDraft; draftId?: string; error?: string }> {
  const { supabase, userId } = await requireUser();
  const { data: contactRow } = await supabase.from("contacts").select(`${CONTACT_COLUMNS}, connection_id, follow_ups_sent`).eq("id", contactId).maybeSingle();
  if (!contactRow) return { error: "Contact not found." };
  const contact = contactRow as Contact & { connection_id: string | null; follow_ups_sent: number };
  const effectiveJobId = jobId ?? contact.job_id;

  const [{ data: job }, { data: search }, { data: profile }, { data: connection }, { data: previous }] = await Promise.all([
    effectiveJobId ? supabase.from("jobs").select("id, title, company, url").eq("id", effectiveJobId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    contact.connection_id ? supabase.from("connections").select(CONNECTION_COLUMNS).eq("id", contact.connection_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("outreach_drafts").select("result").eq("contact_id", contactId).not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (kind === "follow_up" && contact.follow_ups_sent >= MAX_FOLLOW_UPS) return { error: `You've already followed up ${MAX_FOLLOW_UPS} times. Better to let this one rest.` };

  let credential;
  try {
    credential = await resolveCredential(supabase, userId);
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
  if (credential.source === "starter" && !(await starterRunsLeft(supabase, "outreach_drafts", STARTER_DAILY_DRAFTS))) {
    return { error: `Starter includes ${STARTER_DAILY_DRAFTS} drafts a day. Add your own AI key in Settings for unlimited drafts.` };
  }

  const prefs = withDefaults(search);
  const signals = connection ? scoreConnection(connection as Connection, await loadScoringContext(supabase, userId)).reasons : [];
  const { data: match } = job
    ? await supabase.from("job_matches").select("result").eq("job_id", job.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  try {
    const result = await generateStructured({
      credential,
      tier: "standard",
      system: OUTREACH_SYSTEM,
      prompt: buildOutreachPrompt({
        kind,
        candidateName: profile?.full_name ?? "the candidate",
        searchMode: prefs.search_mode,
        targetRoles: prefs.target_roles,
        talkingPoints: (match?.result as JobMatch | undefined)?.talking_points ?? [],
        person: {
          name: contact.full_name,
          position: contact.title,
          company: contact.company,
          relationship: `${labelOf(RELATIONSHIPS, contact.relationship)}; knows them ${["", "barely", "somewhat", "well"][contact.strength]}`,
          signals,
        },
        job: job ? { title: job.title, company: job.company, url: job.url } : null,
        previousMessage: (previous?.result as OutreachDraft | undefined)?.message ?? null,
        daysSinceLastContact: contact.last_contacted_at ? daysSince(contact.last_contacted_at) : null,
        followUpNumber: contact.follow_ups_sent + 1,
      }),
      schema: outreachDraftSchema,
      schemaName: "outreach_draft",
    });
    const draft = {
      ...result.data,
      message: kind === "connection_note" ? result.data.message.slice(0, 300) : result.data.message,
      short_version: result.data.short_version.slice(0, 300),
    };
    const { data: row } = await supabase
      .from("outreach_drafts")
      .insert({ user_id: userId, contact_id: contactId, connection_id: contact.connection_id, job_id: job?.id ?? null, kind, credential: credential.source, provider: credential.provider, model: result.model, result: draft })
      .select("id")
      .single();
    revalidatePath("/dashboard/outreach");
    return { draft, draftId: row?.id };
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    console.error("outreach draft failed", err);
    return { error: "Couldn't write the draft. Please try again." };
  }
}

// The user sent a draft on LinkedIn themselves: record it and schedule the next step.
export async function markDraftSent(draftId: string): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const tz = await userTimeZone(supabase, userId);
  const localDate = (offset = 0) => dateInZone(tz, offset);
  const { data: draft } = await supabase.from("outreach_drafts").select("id, kind, contact_id, sent_at").eq("id", draftId).maybeSingle();
  if (!draft) return { error: "Draft not found." };
  if (draft.sent_at) return {};
  await supabase.from("outreach_drafts").update({ sent_at: new Date().toISOString() }).eq("id", draftId);

  if (draft.contact_id) {
    const { data: c } = await supabase.from("contacts").select("referral_status, follow_ups_sent").eq("id", draft.contact_id).single();
    const update: Record<string, unknown> = { last_contacted_at: localDate(), updated_at: new Date().toISOString() };
    if (draft.kind === "referral_ask") {
      Object.assign(update, { follow_ups_sent: 0, next_follow_up_at: localDate(FOLLOW_UP_AFTER_DAYS) });
      if (c && ["none", "to_ask"].includes(c.referral_status)) update.referral_status = "asked";
    } else if (draft.kind === "follow_up") {
      const sent = (c?.follow_ups_sent ?? 0) + 1;
      Object.assign(update, { follow_ups_sent: sent, next_follow_up_at: sent < MAX_FOLLOW_UPS ? localDate(FOLLOW_UP_AFTER_DAYS) : null });
    } else {
      // Connection note: check back after they've had a week to accept.
      update.next_follow_up_at = localDate(7);
    }
    await supabase.from("contacts").update(update).eq("id", draft.contact_id);
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

// They replied: stop follow-ups and record the outcome.
export async function markReplied(contactId: string, outcome: "agreed" | "referred" | "declined" | null): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const localDate = async () => dateInZone(await userTimeZone(supabase, userId));
  const { error } = await supabase
    .from("contacts")
    .update({ next_follow_up_at: null, last_contacted_at: await localDate(), ...(outcome ? { referral_status: outcome } : {}), updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (error) return { error: "Couldn't update. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function stopFollowUps(contactId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("contacts").update({ next_follow_up_at: null, updated_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { error: "Couldn't update. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}
