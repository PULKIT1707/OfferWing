"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { buildTalentPrompt, isTalentGenerating, TALENT_PROFILE_SYSTEM, talentProfileSchema } from "@/lib/agents/talent-profile";
import { sourceChecker, verifyClaims } from "@/lib/agents/truthfulness";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCareerText } from "@/lib/documents";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";
import { withDefaults } from "@/lib/onboarding";
import { orgErrorMessage } from "@/lib/orgs";
import { AVAILABILITY, findIdentifying, identityTerms, scrubIdentity } from "@/lib/talent";

type Result = { error?: string };

// Users can read and delete their talent profile but not write it (migration 0020): every write
// goes through these actions, after the checks that make the profile anonymous and fact-checked.
const NOT_CONFIGURED = "The talent marketplace isn't available right now.";

export async function buildTalentProfile(): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const admin = createAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };
  const [{ data: existing }, { data: search }, { data: profile }, { data: application }, { data: lastImport }] = await Promise.all([
    supabase.from("talent_profiles").select("status, updated_at, hidden_companies").eq("user_id", userId).maybeSingle(),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase.from("application_profiles").select("first_name, last_name, current_company").eq("user_id", userId).maybeSingle(),
    supabase.from("connection_imports").select("stats").eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (isTalentGenerating(existing)) return {};

  const credential = await credentialForAgent(supabase, userId, "talent_profile");
  if ("error" in credential) return { error: credential.error };
  let careerText: string | null;
  try {
    careerText = await loadCareerText(supabase);
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
  if (!careerText) return { error: "Upload your resume (or LinkedIn PDF) in Settings first." };
  const sourceText = careerText;

  const prefs = withDefaults(search);
  const now = new Date().toISOString();
  // Your current employer is hidden by default, so they can't find you here.
  const hidden = existing?.hidden_companies?.length ? existing.hidden_companies : application?.current_company ? [application.current_company] : [];
  const fields = {
    status: "generating",
    error: null,
    roles: prefs.target_roles,
    seniority: prefs.seniority,
    locations: prefs.locations,
    work_modes: prefs.work_modes,
    open_to_relocate: prefs.open_to_relocate,
    needs_sponsorship: prefs.needs_sponsorship,
    salary_min: prefs.salary_min,
    salary_currency: prefs.salary_currency,
    hidden_companies: hidden,
    updated_at: now,
  };
  const { error } = await admin.from("talent_profiles").upsert({ user_id: userId, ...fields });
  if (error) return { error: "Couldn't start. Please try again." };

  after(async () => {
    const { supabase: userDb } = await requireUser();
    const db = admin;
    try {
      const result = await generateStructured({
        credential,
        tier: "standard",
        system: TALENT_PROFILE_SYSTEM,
        context: `<candidate_documents>\n${sourceText}\n</candidate_documents>`,
        prompt: buildTalentPrompt({ targetRoles: prefs.target_roles, seniority: prefs.seniority }),
        schema: talentProfileSchema,
        schemaName: "talent_profile",
      });
      await recordAgentRun(userDb, userId, "talent_profile", credential, result.model);
      const d = result.data;
      const { skillFound, source } = sourceChecker(sourceText);

      // Anonymity: redact the candidate's name, every employer/school the model found in the documents
      // (only ones that really appear there), their current company and companies from their LinkedIn export.
      const ownCompanies = ((lastImport?.stats as { ownCompanies?: string[] } | null)?.ownCompanies ?? []).slice(0, 30);
      const employers = [...d.employers_and_schools.filter((e) => source.includes(e.toLowerCase().replace(/[^a-z0-9%+.#]+/g, " ").trim())), ...ownCompanies, application?.current_company ?? ""].filter(Boolean);
      const fullName = [application?.first_name, application?.last_name].filter(Boolean).join(" ") || profile?.full_name || null;
      const terms = identityTerms({ fullName, employers });

      const verification = verifyClaims(
        d.highlights.map((h, i) => ({ where: `Highlight ${i + 1}`, text: h.text, evidence: h.evidence })),
        [
          { where: "Headline", text: d.headline },
          { where: "Summary", text: d.summary },
        ],
        sourceText,
      );
      const unsupported = new Set(verification.flagged.filter((f) => f.where.startsWith("Highlight")).map((f) => f.text));

      await db
        .from("talent_profiles")
        .update({
          status: "draft",
          headline: scrubIdentity(d.headline, terms).slice(0, 200),
          summary: scrubIdentity(d.summary, terms).slice(0, 1500),
          years_experience: Math.max(0, Math.min(60, Math.round(d.years_experience))) || null,
          industries: d.industries.slice(0, 6).map((s) => s.slice(0, 80)),
          skills: d.skills.filter(skillFound).slice(0, 20).map((s) => s.slice(0, 60)),
          highlights: d.highlights
            .filter((h) => !unsupported.has(h.text))
            .slice(0, 6)
            .map((h) => ({ text: scrubIdentity(h.text, terms).slice(0, 400), evidence: h.evidence.slice(0, 500) })),
          verification,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } catch (err) {
      if (!(err instanceof UserFacingError)) console.error("talent profile failed", userId, err);
      const message = err instanceof UserFacingError ? err.message : "Something went wrong while writing your profile. Please try again.";
      await db.from("talent_profiles").update({ status: "failed", visible: false, error: message, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
  });
  revalidatePath("/dashboard/talent");
  return {};
}

const editSchema = z.object({
  headline: z.string().trim().min(3, "Add a headline").max(200),
  summary: z.string().trim().max(1500),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  highlights: z.array(z.object({ text: z.string().trim().min(1).max(400), evidence: z.string().max(500) })).max(6),
  availability: z.enum(AVAILABILITY.map(([v]) => v) as [string, ...string[]]),
  hidden_companies: z.array(z.string().trim().min(1).max(120)).max(20),
});
export type TalentEdit = z.input<typeof editSchema>;

export async function saveTalentProfile(edit: TalentEdit): Promise<Result> {
  const parsed = editSchema.safeParse(edit);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const contact = findIdentifying([d.headline, d.summary, ...d.highlights.map((h) => h.text)].join("\n"), []);
  if (contact.length) return { error: `Your profile is anonymous: remove ${contact.join(" and ")}. Recruiters get your contact details only when you accept an intro.` };
  const { userId } = await requireUser();
  const admin = createAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };
  const { error } = await admin
    .from("talent_profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "draft");
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/talent");
  return {};
}

export async function setTalentVisibility(visible: boolean): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data: t } = await supabase.from("talent_profiles").select("status, headline, published_at").eq("user_id", userId).maybeSingle();
  if (visible && (t?.status !== "draft" || !t.headline)) return { error: "Build your profile first." };
  const admin = createAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };
  const { error } = await admin
    .from("talent_profiles")
    .update({ visible, ...(visible && !t?.published_at ? { published_at: new Date().toISOString() } : {}) })
    .eq("user_id", userId);
  if (error) return { error: "Couldn't update your visibility." };
  revalidatePath("/dashboard/talent");
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function deleteTalentProfile(): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("talent_profiles").delete().eq("user_id", userId);
  if (error) return { error: "Couldn't delete your profile." };
  revalidatePath("/dashboard/talent");
  return {};
}

export async function respondToIntro(id: string, accept: boolean): Promise<{ error?: string; jobId?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("respond_intro", { p_id: id, p_accept: accept });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath("/dashboard", "layout");
  return { jobId: (data as string | null) ?? undefined };
}
