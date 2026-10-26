"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  buildFeedbackPrompt,
  buildPrepContext,
  buildPrepPrompt,
  buildStoryPrompt,
  FEEDBACK_SYSTEM,
  feedbackSchema,
  isPrepRunning,
  normalizeFeedback,
  PREP_SYSTEM,
  prepPackSchema,
  ROUNDS,
  STORY_BANK_SYSTEM,
  STORY_COLUMNS,
  storyBankSchema,
  type Feedback,
  type Round,
  type Story,
} from "@/lib/agents/interviews";
import type { JobMatch } from "@/lib/agents/job-match";
import { buildNegotiationPrompt, NEGOTIATION_SYSTEM, negotiationSchema, OFFER_COLUMNS, type Offer } from "@/lib/agents/negotiation";
import { requireUser } from "@/lib/auth";
import { loadCareerText } from "@/lib/documents";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { modelFor } from "@/lib/llm/models";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { recordAgentRun, type StarterAgent } from "@/lib/llm/quota";
import { researchWithWeb } from "@/lib/llm/research";
import { withDefaults } from "@/lib/onboarding";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

// Resolves the user's AI credential and claims one Starter run of the agent (see agent-credential.ts).
const credentialFor = (supabase: Supabase, userId: string, agent: StarterAgent) => credentialForAgent(supabase, userId, agent);
const friendly = (err: unknown, fallback: string) => {
  if (err instanceof UserFacingError) return err.message;
  console.error(fallback, err);
  return fallback;
};

// ---- Story bank ----

export async function extractStories(): Promise<{ error?: string; added?: number }> {
  const { supabase, userId } = await requireUser();
  const careerText = await loadCareerText(supabase).catch((e) => (e instanceof UserFacingError ? e : null));
  if (careerText instanceof UserFacingError) return { error: careerText.message };
  if (!careerText) return { error: "Upload your resume or LinkedIn PDF in Settings first." };

  const credential = await credentialForAgent(supabase, userId, "story_bank");
  if ("error" in credential) return credential;

  try {
    const result = await generateStructured({ credential, tier: "standard", system: STORY_BANK_SYSTEM, prompt: buildStoryPrompt(careerText), schema: storyBankSchema, schemaName: "story_bank" });
    await recordAgentRun(supabase, userId, "story_bank", credential, result.model);
    // Replace earlier extracted stories; stories the user wrote or edited by hand stay.
    await supabase.from("stories").delete().eq("user_id", userId).eq("source", "extracted");
    const rows = result.data.stories.slice(0, 15).map((s) => ({ ...s, user_id: userId, source: "extracted", title: s.title.slice(0, 200) }));
    const { error } = await supabase.from("stories").insert(rows);
    if (error) return { error: "Couldn't save the stories. Please try again." };
    revalidatePath("/dashboard/interviews");
    return { added: rows.length };
  } catch (err) {
    return { error: friendly(err, "Couldn't build your story bank. Please try again.") };
  }
}

const storyInput = z.object({
  title: z.string().trim().min(1, "Give the story a title").max(200),
  situation: z.string().trim().max(2000),
  task: z.string().trim().max(2000),
  action: z.string().trim().max(3000),
  result: z.string().trim().max(2000),
  competencies: z.array(z.string().trim().min(1).max(40)).max(8),
});

export async function saveStory(id: string | null, input: unknown): Promise<{ error?: string; story?: Story }> {
  const parsed = storyInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the story." };
  const { supabase, userId } = await requireUser();
  // Editing an extracted story makes it the user's own, so re-extraction won't overwrite it.
  const values = { ...parsed.data, source: "manual", updated_at: new Date().toISOString() };
  const q = id ? supabase.from("stories").update(values).eq("id", id) : supabase.from("stories").insert({ ...values, user_id: userId });
  const { data, error } = await q.select(STORY_COLUMNS).single();
  if (error || !data) return { error: "Couldn't save the story." };
  revalidatePath("/dashboard/interviews");
  return { story: data as Story };
}

export async function deleteStory(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the story." };
  revalidatePath("/dashboard/interviews");
  return {};
}

// ---- Prep packs ----

export async function startPrep(jobId: string, round: Round, interviewerNotes: string): Promise<{ error?: string }> {
  if (!ROUNDS.some(([r]) => r === round)) return { error: "Pick the interview round." };
  const { supabase, userId } = await requireUser();
  const [{ data: job }, { data: latest }] = await Promise.all([
    supabase.from("jobs").select("id, title, company, description").eq("id", jobId).maybeSingle(),
    supabase.from("interview_preps").select("status, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!job) return { error: "Job not found." };
  if (isPrepRunning(latest)) return { error: "A prep pack is already being written for this job." };

  const credential = await credentialFor(supabase, userId, "interview_prep");
  if ("error" in credential) return credential;

  const { data: run, error } = await supabase
    .from("interview_preps")
    .insert({ user_id: userId, job_id: jobId, round, interviewer_notes: interviewerNotes.trim().slice(0, 2000) || null, credential: credential.source, provider: credential.provider, model: modelFor(credential.provider, "standard") })
    .select("id")
    .single();
  if (error || !run) return { error: "Couldn't start. Please try again." };

  after(async () => {
    const { supabase: db } = await requireUser();
    try {
      const [careerText, { data: stories }, { data: match }] = await Promise.all([
        loadCareerText(db),
        db.from("stories").select(STORY_COLUMNS),
        db.from("job_matches").select("result").eq("job_id", jobId).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const research = await researchWithWeb(
        credential,
        `Research ${job.company} for a candidate interviewing for "${job.title}": what the company does, its products and customers, recent news from the last 12 months, culture and values, and what the team for this role likely works on.`,
      );
      const result = await generateStructured({
        credential,
        tier: "standard",
        system: PREP_SYSTEM,
        context: buildPrepContext(careerText ?? "No resume uploaded.", (stories ?? []) as Story[]),
        prompt: buildPrepPrompt({ job, round, interviewerNotes, match: (match?.result as JobMatch | undefined) ?? null, research: research?.text ?? null }),
        schema: prepPackSchema,
        schemaName: "prep_pack",
      });
      await db
        .from("interview_preps")
        .update({
          status: "complete",
          result: { ...result.data, sources: research?.sources ?? [] },
          researched: !!research,
          model: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    } catch (err) {
      await db
        .from("interview_preps")
        .update({ status: "failed", error: friendly(err, "Something went wrong while preparing. Please try again."), completed_at: new Date().toISOString() })
        .eq("id", run.id);
    }
  });
  revalidatePath(`/dashboard/interviews/${jobId}`);
  return {};
}

// ---- Practice ----

export async function practiceAnswer(jobId: string | null, question: string, answer: string): Promise<{ error?: string; feedback?: Feedback }> {
  const q = question.trim().slice(0, 1000);
  const a = answer.trim().slice(0, 8000);
  if (!q || a.length < 20) return { error: "Write a fuller answer first (a few sentences)." };
  const { supabase, userId } = await requireUser();
  const credential = await credentialFor(supabase, userId, "practice_answer");
  if ("error" in credential) return credential;
  const { data: job } = jobId ? await supabase.from("jobs").select("title, company").eq("id", jobId).maybeSingle() : { data: null };

  try {
    const result = await generateStructured({
      credential,
      tier: "standard",
      system: FEEDBACK_SYSTEM,
      prompt: buildFeedbackPrompt(q, a, job ? `${job.title} at ${job.company}` : null),
      schema: feedbackSchema,
      schemaName: "practice_feedback",
    });
    const feedback = normalizeFeedback(result.data);
    await supabase.from("practice_answers").insert({ user_id: userId, job_id: jobId, question: q, answer: a, feedback, credential: credential.source, provider: credential.provider, model: result.model });
    return { feedback };
  } catch (err) {
    return { error: friendly(err, "Couldn't review your answer. Please try again.") };
  }
}

// ---- Offers ----

const offerInput = z.object({
  job_id: z.string().uuid().nullable(),
  company: z.string().trim().min(1, "Add the company").max(200),
  title: z.string().trim().min(1, "Add the job title").max(200),
  currency: z.string().trim().min(3).max(3),
  base_salary: z.number().int().min(0).nullable(),
  bonus_target: z.number().int().min(0).nullable(),
  sign_on: z.number().int().min(0).nullable(),
  equity: z.string().trim().max(500).nullable(),
  benefits: z.string().trim().max(2000).nullable(),
  work_mode: z.string().trim().max(100).nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["pending", "negotiating", "accepted", "declined"]),
  notes: z.string().trim().max(3000).nullable(),
});

export async function saveOffer(id: string | null, input: unknown): Promise<{ error?: string; offer?: Offer }> {
  const parsed = offerInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the offer details." };
  const { supabase, userId } = await requireUser();
  const values = { ...parsed.data, updated_at: new Date().toISOString() };
  const q = id ? supabase.from("offers").update(values).eq("id", id) : supabase.from("offers").insert({ ...values, user_id: userId });
  const { data, error } = await q.select(OFFER_COLUMNS).single();
  if (error || !data) return { error: "Couldn't save the offer." };
  // An offer on a pipeline job moves that job to the Offer stage.
  if (!id && parsed.data.job_id) await supabase.from("jobs").update({ stage: "offer", stage_changed_at: new Date().toISOString() }).eq("id", parsed.data.job_id).neq("stage", "offer");
  revalidatePath("/dashboard", "layout");
  return { offer: data as Offer };
}

export async function deleteOffer(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the offer." };
  revalidatePath("/dashboard/interviews");
  return {};
}

export async function planNegotiation(offerId: string): Promise<{ error?: string; offer?: Offer }> {
  const { supabase, userId } = await requireUser();
  const [{ data: offers }, { data: search }, { data: profile }] = await Promise.all([
    supabase.from("offers").select(OFFER_COLUMNS),
    supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
  ]);
  const offer = (offers as Offer[] | null)?.find((o) => o.id === offerId);
  if (!offer) return { error: "Offer not found." };

  const credential = await credentialFor(supabase, userId, "negotiation");
  if ("error" in credential) return credential;
  const prefs = withDefaults(search);
  const salaryGoal =
    prefs.salary_min != null || prefs.salary_target != null ? `minimum ${prefs.salary_min ?? "?"}, target ${prefs.salary_target ?? "?"} ${prefs.salary_currency}` : "not specified";
  const { data: match } = offer.job_id
    ? await supabase.from("job_matches").select("result").eq("job_id", offer.job_id).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const m = match?.result as JobMatch | undefined;

  try {
    const result = await generateStructured({
      credential,
      tier: "premium",
      system: NEGOTIATION_SYSTEM,
      prompt: buildNegotiationPrompt({
        offer,
        otherOffers: (offers as Offer[]).filter((o) => o.id !== offerId && o.status !== "declined"),
        salaryGoal,
        fitSummary: m ? `Fit ${m.fit_score}/100 (${m.verdict}). Strengths: ${m.matched.map((x) => x.requirement).join("; ")}` : null,
        candidateName: profile?.full_name ?? "the candidate",
      }),
      schema: negotiationSchema,
      schemaName: "negotiation_plan",
    });
    const { data, error } = await supabase
      .from("offers")
      .update({ negotiation: result.data, negotiation_model: result.model, negotiation_updated_at: new Date().toISOString() })
      .eq("id", offerId)
      .select(OFFER_COLUMNS)
      .single();
    if (error || !data) return { error: "Couldn't save the plan." };
    revalidatePath("/dashboard/interviews");
    return { offer: data as Offer };
  } catch (err) {
    return { error: friendly(err, "Couldn't write the negotiation plan. Please try again.") };
  }
}
