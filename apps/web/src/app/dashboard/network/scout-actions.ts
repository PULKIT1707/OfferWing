"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  buildReferralPrompt,
  CONNECTION_COLUMNS,
  isImportRunning,
  ownCompanyKeysFrom,
  REFERRAL_DRAFT_SYSTEM,
  referralDraftSchema,
  roleTermsFrom,
  scoreConnection,
  STARTER_DAILY_DRAFTS,
  type Connection,
  type ReferralDraft,
} from "@/lib/agents/referral-scout";
import type { JobMatch } from "@/lib/agents/job-match";
import { requireUser } from "@/lib/auth";
import { sameCompany } from "@/lib/dashboard";
import { parseLinkedInExport } from "@/lib/linkedin-export";
import { resolveCredential } from "@/lib/llm/credentials";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { withDefaults } from "@/lib/onboarding";
import { ensureContactForConnection } from "@/lib/referrals";

const CHUNK = 500;

export async function startConnectionImport(): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const [{ data: doc }, { data: latest }] = await Promise.all([
    supabase.from("career_documents").select("id, storage_path, file_name").eq("kind", "linkedin_export").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("connection_imports").select("status, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!doc) return { error: "Upload your LinkedIn data export (ZIP) in Settings → Documents first." };
  if (isImportRunning(latest)) {
    return { error: "An import is already running." };
  }

  const { data: run, error } = await supabase.from("connection_imports").insert({ user_id: userId, document_id: doc.id }).select("id").single();
  if (error || !run) return { error: "Couldn't start the import. Please try again." };

  after(async () => {
    const { supabase: db } = await requireUser();
    const fail = (message: string) =>
      db.from("connection_imports").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", run.id);
    try {
      const { data: file, error: dlError } = await db.storage.from("career-docs").download(doc.storage_path);
      if (dlError || !file) return void (await fail(`Couldn't open ${doc.file_name}. Try uploading it again.`));

      let parsed;
      try {
        parsed = parseLinkedInExport(new Uint8Array(await file.arrayBuffer()));
      } catch (e) {
        const code = (e as Error).message;
        return void (await fail(
          code === "NO_CONNECTIONS"
            ? "This ZIP doesn't contain Connections.csv. Request the full LinkedIn data export (it includes connections and messages)."
            : "That file isn't a readable ZIP. Upload the file LinkedIn emailed you, without unzipping it.",
        ));
      }

      // Update people already imported (keeps links from your referral list), add new ones, drop people you're no longer connected to.
      const { data: existing } = await db.from("connections").select("id, profile_url");
      const idByUrl = new Map((existing ?? []).filter((e) => e.profile_url).map((e) => [e.profile_url as string, e.id]));
      const now = new Date().toISOString();
      const rows = parsed.connections.map((c) => ({
        ...c,
        id: (c.profile_url && idByUrl.get(c.profile_url)) || crypto.randomUUID(),
        user_id: userId,
        imported_at: now,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error: upsertError } = await db.from("connections").upsert(rows.slice(i, i + CHUNK), { onConflict: "id" });
        if (upsertError) throw upsertError;
      }
      await db.from("connections").delete().lt("imported_at", now);

      await db
        .from("connection_imports")
        .update({ status: "complete", stats: { ...parsed.stats, ownCompanies: parsed.ownCompanies }, completed_at: new Date().toISOString() })
        .eq("id", run.id);
    } catch (err) {
      console.error("connection import failed", run.id, err);
      await fail("Something went wrong while importing. Please try again.");
    }
  });
  revalidatePath("/dashboard/network");
  return {};
}

export async function deleteImportedConnections(): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const [a, b] = await Promise.all([
    supabase.from("connections").delete().eq("user_id", userId),
    supabase.from("connection_imports").delete().eq("user_id", userId),
  ]);
  if (a.error || b.error) return { error: "Couldn't delete imported connections. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function searchConnections(query: string): Promise<Connection[]> {
  const q = query.trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q.length < 2) return [];
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("connections")
    .select(CONNECTION_COLUMNS)
    .or(`full_name.ilike.%${q}%,company.ilike.%${q}%,position.ilike.%${q}%`)
    .order("message_count", { ascending: false })
    .limit(25);
  return (data ?? []) as Connection[];
}

export async function addConnectionToList(connectionId: string, jobId: string | null): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUser();
  const { data: c } = await supabase.from("connections").select(CONNECTION_COLUMNS).eq("id", connectionId).maybeSingle();
  if (!c) return { error: "Connection not found." };
  const contact = await ensureContactForConnection(supabase, userId, c as Connection, jobId);
  if (!contact) return { error: "Couldn't add them to your list. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function draftReferralAsk(connectionId: string, jobId: string | null): Promise<{ draft?: ReferralDraft; contactId?: string; draftId?: string; error?: string }> {
  const { supabase, userId } = await requireUser();
  const [{ data: conn }, { data: job }, { data: search }, { data: profile }, { data: lastImport }] = await Promise.all([
    supabase.from("connections").select(CONNECTION_COLUMNS).eq("id", connectionId).maybeSingle(),
    jobId ? supabase.from("jobs").select("id, title, company, url").eq("id", jobId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase.from("connection_imports").select("stats").eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!conn) return { error: "Connection not found." };
  const connection = conn as Connection;
  if (job && !sameCompany(job.company, connection.company)) return { error: `${connection.full_name} doesn't work at ${job.company}.` };

  let credential;
  try {
    credential = await resolveCredential(supabase, userId);
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
  if (credential.source === "starter") {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await supabase.from("outreach_drafts").select("id", { count: "exact", head: true }).eq("credential", "starter").gte("created_at", since.toISOString());
    if ((count ?? 0) >= STARTER_DAILY_DRAFTS) return { error: `Starter includes ${STARTER_DAILY_DRAFTS} drafts a day. Add your own AI key in Settings for unlimited drafts.` };
  }

  const prefs = withDefaults(search);
  const { data: match } = job
    ? await supabase.from("job_matches").select("result").eq("job_id", job.id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const scored = scoreConnection(connection, {
    roleTerms: roleTermsFrom(...prefs.target_roles, job?.title ?? ""),
    ownCompanyKeys: ownCompanyKeysFrom(((lastImport?.stats as { ownCompanies?: string[] } | null)?.ownCompanies) ?? []),
  });

  try {
    const result = await generateStructured({
      credential,
      tier: "standard",
      system: REFERRAL_DRAFT_SYSTEM,
      prompt: buildReferralPrompt({
        candidateName: profile?.full_name ?? "the candidate",
        searchMode: prefs.search_mode,
        connection,
        relationship: scored.reasons,
        job: job ? { title: job.title, company: job.company, url: job.url } : null,
        talkingPoints: (match?.result as JobMatch | undefined)?.talking_points ?? [],
        targetRoles: prefs.target_roles,
      }),
      schema: referralDraftSchema,
      schemaName: "referral_draft",
    });
    const draft = { ...result.data, short_version: result.data.short_version.slice(0, 300) };
    const contact = await ensureContactForConnection(supabase, userId, connection, job?.id ?? null);
    const { data: draftRow } = await supabase.from("outreach_drafts").insert({
      user_id: userId,
      connection_id: connection.id,
      contact_id: contact?.id ?? null,
      job_id: job?.id ?? null,
      kind: "referral_ask",
      credential: credential.source,
      provider: credential.provider,
      model: result.model,
      result: draft,
    }).select("id").single();
    revalidatePath("/dashboard", "layout");
    return { draft, contactId: contact?.id, draftId: draftRow?.id };
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    console.error("referral draft failed", err);
    return { error: "Couldn't write the draft. Please try again." };
  }
}
