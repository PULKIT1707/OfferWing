import { NextResponse } from "next/server";
import { z } from "zod";
import { CONNECTION_COLUMNS, scoreConnection, type Connection } from "@/lib/agents/referral-scout";
import { jsonError, requireBearerUser } from "@/lib/api-auth";
import { companyKey, OPEN_STAGES, sameCompany } from "@/lib/dashboard";
import { canonicalJobUrl, normalizeProfileUrl } from "@/lib/linkedin-urls";
import { loadScoringContext, scoredPeopleAt } from "@/lib/referrals";

const body = z.object({
  kind: z.enum(["job", "profile", "company"]),
  url: z.string().url().max(2000),
  company: z.string().trim().max(200).nullable().optional(),
});

// Everything the side panel shows for the LinkedIn page the user is on.
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");
  const { kind, url } = parsed.data;

  const [ctx, { data: search }, { data: contacts }] = await Promise.all([
    loadScoringContext(supabase, userId),
    supabase.from("search_profiles").select("dream_companies, excluded_companies").eq("user_id", userId).maybeSingle(),
    supabase.from("contacts").select("connection_id, referral_status"),
  ]);
  const listStatus = new Map((contacts ?? []).filter((c) => c.connection_id).map((c) => [c.connection_id as string, c.referral_status]));
  const withStatus = <T extends { id: string }>(p: T) => ({ ...p, listStatus: listStatus.get(p.id) ?? null });

  let company = parsed.data.company ?? null;
  let job = null;
  let match = null;
  let connection = null;

  if (kind === "job") {
    const canonical = canonicalJobUrl(url);
    if (canonical) {
      const { data } = await supabase.from("jobs").select("id, title, company, stage, fit_score, description").eq("url", canonical).maybeSingle();
      job = data ? { ...data, description: undefined, hasDescription: !!data.description?.trim() } : null;
      if (data) {
        company ??= data.company;
        const { data: m } = await supabase
          .from("job_matches")
          .select("status, result, error, created_at")
          .eq("job_id", data.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        match = m;
      }
    }
  } else if (kind === "profile") {
    const profileUrl = normalizeProfileUrl(url);
    if (profileUrl) {
      const { data } = await supabase.from("connections").select(CONNECTION_COLUMNS).eq("profile_url", profileUrl).maybeSingle();
      if (data) {
        connection = withStatus(scoreConnection(data as Connection, ctx));
        company ??= data.company;
      }
    }
  }

  const key = companyKey(company);
  const people = key ? (await scoredPeopleAt(supabase, ctx, key)).slice(0, 8).map(withStatus) : [];
  const { data: jobsAtCompany } = key
    ? await supabase.from("jobs").select("id, title, company, stage, fit_score").in("stage", OPEN_STAGES)
    : { data: [] };

  return NextResponse.json({
    company,
    isTarget: !!search?.dream_companies?.some((c: string) => sameCompany(c, company)),
    isExcluded: !!search?.excluded_companies?.some((c: string) => sameCompany(c, company)),
    job,
    match,
    connection,
    people,
    jobsAtCompany: (jobsAtCompany ?? []).filter((j) => sameCompany(j.company, company)),
  });
}
