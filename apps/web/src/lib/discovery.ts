import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameCompany } from "@/lib/dashboard";
import { alertAliasFrom, classifyInbound, parseForwardingConfirmation, parseLinkedInAlert } from "@/lib/job-alerts";
import { fetchBoard, matchesTargetRoles, nameFromToken, normalizeJobUrl, titleExcluded, withDetails, type Board, type Posting, type SourceKind } from "@/lib/job-sources";

export type DiscoveredJob = {
  externalId: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  source: "alert" | "ats";
};

export const ALERT_DOMAIN = () => process.env.ALERT_EMAIL_DOMAIN ?? "alerts.offerwing.app";

// Adds new jobs to the user's inbox ("discovered"), skipping ones already known (by source ID or by
// URL, compared without tracking parameters), companies on their avoid list and titles with their
// excluded words. `enrich` fills in missing descriptions for the new ones only. Returns how many were added.
export async function insertDiscoveredJobs(
  db: SupabaseClient,
  userId: string,
  items: DiscoveredJob[],
  excludedCompanies: string[],
  options: { titleExclude?: string[]; enrich?: (jobs: DiscoveredJob[]) => Promise<DiscoveredJob[]> } = {},
): Promise<number> {
  const candidates = items
    .filter((j) => j.title.trim() && !excludedCompanies.some((c) => sameCompany(c, j.company)) && !titleExcluded(j.title, options.titleExclude ?? []))
    .map((j) => ({ ...j, url: normalizeJobUrl(j.url) }));
  if (!candidates.length) return 0;
  const rawUrls = items.map((i) => i.url);
  const [byId, byUrl] = await Promise.all([
    db.from("jobs").select("external_id").eq("user_id", userId).in("external_id", candidates.map((c) => c.externalId)),
    db.from("jobs").select("url").eq("user_id", userId).in("url", [...new Set([...candidates.map((c) => c.url), ...rawUrls])]),
  ]);
  const knownIds = new Set((byId.data ?? []).map((r) => r.external_id));
  const knownUrls = new Set((byUrl.data ?? []).map((r) => normalizeJobUrl(r.url)));
  const unique = candidates.filter(
    (c, i) => !knownIds.has(c.externalId) && !knownUrls.has(c.url) && candidates.findIndex((d) => d.externalId === c.externalId || d.url === c.url) === i,
  );
  if (!unique.length) return 0;
  const fresh = options.enrich ? await options.enrich(unique) : unique;

  const { error } = await db.from("jobs").insert(
    fresh.map((j) => ({
      user_id: userId,
      title: j.title.slice(0, 200),
      company: (j.company?.trim() || "Unknown company").slice(0, 200),
      location: j.location?.slice(0, 200) ?? null,
      url: j.url,
      description: j.description,
      source: j.source,
      stage: "discovered",
      external_id: j.externalId,
    })),
  );
  if (error) throw error;
  return fresh.length;
}

type SourceRow = { id: string; user_id: string; kind: SourceKind; board_token: string; company_name: string; only_matching: boolean };
type Prefs = { target_roles: string[]; excluded_companies: string[]; title_exclude: string[] };
const NO_PREFS: Prefs = { target_roles: [], excluded_companies: [], title_exclude: [] };

// Polls career boards, fetching each board once even when several users follow it.
export async function pollSources(db: SupabaseClient, sources: SourceRow[], prefsByUser: Map<string, Prefs>): Promise<{ checked: number; added: number }> {
  const boards = new Map<string, Promise<Board>>();
  let added = 0;
  for (const s of sources) {
    const key = `${s.kind}:${s.board_token.toLowerCase()}`;
    if (!boards.has(key)) boards.set(key, fetchBoard(s.kind, s.board_token));
    const prefs = prefsByUser.get(s.user_id) ?? NO_PREFS;
    try {
      const board = await boards.get(key)!;
      const postings = s.only_matching ? board.postings.filter((p) => matchesTargetRoles(p.title, prefs.target_roles, prefs.title_exclude)) : board.postings;
      const count = await insertDiscoveredJobs(
        db,
        s.user_id,
        postings.map((p) => ({ ...p, company: s.company_name, source: "ats" as const })),
        prefs.excluded_companies,
        {
          titleExclude: prefs.title_exclude,
          // Boards whose listing has no description (SmartRecruiters) are read per new posting.
          enrich: async (jobs) => {
            const withText = await withDetails(s.kind, s.board_token, jobs as (DiscoveredJob & Posting)[]);
            return withText.map((p, i) => ({ ...jobs[i], description: p.description }));
          },
        },
      );
      added += count;
      await db.from("job_sources").update({ last_checked_at: new Date().toISOString(), last_found: count, last_error: null }).eq("id", s.id);
    } catch (err) {
      await db.from("job_sources").update({ last_checked_at: new Date().toISOString(), last_error: (err as Error).message.slice(0, 300) }).eq("id", s.id);
    }
  }
  return { checked: sources.length, added };
}

export async function loadPrefs(db: SupabaseClient, userIds: string[]): Promise<Map<string, Prefs>> {
  const { data } = await db.from("search_profiles").select("user_id, target_roles, excluded_companies, title_exclude").in("user_id", userIds);
  return new Map(
    (data ?? []).map((p) => [p.user_id, { target_roles: p.target_roles ?? [], excluded_companies: p.excluded_companies ?? [], title_exclude: p.title_exclude ?? [] }]),
  );
}

export { nameFromToken };

export type InboundEmail = { from: string; subject: string; text: string | null; html: string | null; recipients: string[] };

// Handles an email sent to a user's alert address. `admin` must be a service-role client:
// there is no user session on inbound mail.
export async function ingestInboundEmail(admin: SupabaseClient, email: InboundEmail): Promise<{ status: string; jobsAdded?: number }> {
  const alias = alertAliasFrom(email.recipients, ALERT_DOMAIN());
  if (!alias) return { status: "ignored: not an alert address" };
  const { data: profile } = await admin.from("profiles").select("id").eq("alert_alias", alias).maybeSingle();
  if (!profile) return { status: "ignored: unknown alias" };

  const kind = classifyInbound(email.from, email.subject);
  let jobsAdded = 0;
  let detail: Record<string, unknown> | null = null;

  if (kind === "linkedin_alert") {
    const jobs = parseLinkedInAlert({ html: email.html, text: email.text });
    const prefs = (await loadPrefs(admin, [profile.id])).get(profile.id);
    jobsAdded = await insertDiscoveredJobs(
      admin,
      profile.id,
      jobs.map((j) => ({ ...j, description: null, source: "alert" as const })),
      prefs?.excluded_companies ?? [],
      { titleExclude: prefs?.title_exclude },
    );
    detail = { parsed: jobs.length };
  } else if (kind === "forwarding_confirmation") {
    detail = parseForwardingConfirmation(email.subject, email.text ?? "");
  }

  await admin.from("inbound_emails").insert({
    user_id: profile.id,
    from_address: email.from.slice(0, 300),
    subject: email.subject.slice(0, 300),
    kind,
    jobs_found: jobsAdded,
    detail,
  });
  return { status: kind, jobsAdded };
}
