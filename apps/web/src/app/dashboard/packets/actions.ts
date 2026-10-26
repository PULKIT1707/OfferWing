"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { JobMatch } from "@/lib/agents/job-match";
import { buildPacketPrompt, isPacketGenerating, normalizePacket, PACKET_DAYS, REFERRAL_PACKET_SYSTEM, referralPacketSchema } from "@/lib/agents/referral-packet";
import { verifyClaims } from "@/lib/agents/truthfulness";
import { requireUser } from "@/lib/auth";
import { loadCareerText } from "@/lib/documents";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";
import { withDefaults } from "@/lib/onboarding";

export async function createReferralPacket(jobId: string, connectionId: string | null): Promise<{ id?: string; error?: string }> {
  const { supabase, userId } = await requireUser();
  const [{ data: job }, { data: connection }, { data: profile }, { data: application }, { data: kit }, { data: existing }] = await Promise.all([
    supabase.from("jobs").select("id, title, company, description").eq("id", jobId).maybeSingle(),
    connectionId ? supabase.from("connections").select("id, full_name").eq("id", connectionId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase.from("application_profiles").select("first_name, last_name, linkedin_url").eq("user_id", userId).maybeSingle(),
    supabase.from("application_kits").select("id").eq("job_id", jobId).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("referral_packets").select("id, status, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!job) return { error: "Job not found." };
  if (isPacketGenerating(existing)) return { id: existing!.id };

  const credential = await credentialForAgent(supabase, userId, "referral_packet");
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

  const candidateName = [application?.first_name, application?.last_name].filter(Boolean).join(" ") || profile?.full_name || "The candidate";
  const { data: packet, error } = await supabase
    .from("referral_packets")
    .insert({
      user_id: userId,
      job_id: jobId,
      connection_id: connection?.id ?? null,
      referrer_name: connection?.full_name ?? null,
      candidate_name: candidateName,
      linkedin_url: application?.linkedin_url ?? null,
      kit_id: kit?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !packet) return { error: "Couldn't start the packet. Please try again." };

  after(async () => {
    const { supabase: db } = await requireUser();
    try {
      const [{ data: search }, { data: match }] = await Promise.all([
        db.from("search_profiles").select("search_mode").eq("user_id", userId).maybeSingle(),
        db.from("job_matches").select("result").eq("job_id", jobId).eq("status", "complete").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const result = await generateStructured({
        credential,
        tier: "standard",
        system: REFERRAL_PACKET_SYSTEM,
        context: `<candidate_documents>\n${sourceText}\n</candidate_documents>`,
        prompt: buildPacketPrompt({
          job,
          match: (match?.result as JobMatch | undefined) ?? null,
          referrerName: connection?.full_name ?? null,
          candidateName,
          stealth: withDefaults(search).search_mode === "stealth",
        }),
        schema: referralPacketSchema,
        schemaName: "referral_packet",
      });
      await recordAgentRun(db, userId, "referral_packet", credential, result.model);
      const draft = normalizePacket(result.data);
      const verification = verifyClaims(
        draft.fit_points.map((f, i) => ({ where: `Fit point ${i + 1}`, text: f.point, evidence: f.evidence })),
        [
          { where: "Headline", text: draft.headline },
          { where: "Blurb", text: draft.blurb },
          { where: "Note to referrer", text: draft.note_to_referrer },
        ],
        sourceText,
      );
      // Points we can't trace to the documents never reach the page; the user sees what was removed.
      const unsupported = new Set(verification.flagged.filter((f) => f.where.startsWith("Fit point") && f.reasons.some((r) => r.startsWith("Supporting quote not found"))).map((f) => f.text));
      await db
        .from("referral_packets")
        .update({
          status: "draft",
          headline: draft.headline,
          candidate_headline: draft.headline,
          fit_points: draft.fit_points.filter((f) => !unsupported.has(f.point)),
          blurb: draft.blurb,
          note_to_referrer: draft.note_to_referrer,
          verification,
          updated_at: new Date().toISOString(),
        })
        .eq("id", packet.id);
    } catch (err) {
      if (!(err instanceof UserFacingError)) console.error("referral packet failed", packet.id, err);
      const message = err instanceof UserFacingError ? err.message : "Something went wrong while writing the packet. Please try again.";
      await db.from("referral_packets").update({ status: "failed", error: message }).eq("id", packet.id);
    }
  });
  revalidatePath("/dashboard/network");
  return { id: packet.id };
}

const editSchema = z.object({
  referrer_name: z.string().trim().max(200).transform((s) => s || null).nullable(),
  headline: z.string().trim().min(1, "Add a headline").max(300),
  fit_points: z.array(z.object({ point: z.string().trim().min(1).max(500), evidence: z.string().max(500) })).min(1, "Keep at least one reason").max(6),
  blurb: z.string().trim().min(1, "Add a blurb").max(1500),
  note_to_referrer: z.string().trim().max(1500),
  include_resume: z.boolean(),
});
export type PacketEdit = z.input<typeof editSchema>;

export async function saveReferralPacket(id: string, edit: PacketEdit, publish: boolean): Promise<{ error?: string }> {
  const parsed = editSchema.safeParse(edit);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the packet." };
  const { supabase } = await requireUser();
  const { data: current } = await supabase.from("referral_packets").select("status").eq("id", id).maybeSingle();
  if (!current || current.status === "generating" || current.status === "failed") return { error: "This packet can't be edited right now." };
  const now = new Date();
  const { error } = await supabase
    .from("referral_packets")
    .update({
      ...parsed.data,
      candidate_headline: parsed.data.headline,
      ...(publish ? { status: "live", expires_at: new Date(now.getTime() + PACKET_DAYS * 86_400_000).toISOString() } : {}),
      updated_at: now.toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath(`/dashboard/packets/${id}`);
  revalidatePath("/dashboard/network");
  return {};
}

export async function setPacketStatus(id: string, status: "revoked" | "draft"): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("referral_packets").update({ status, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["live", "draft", "revoked"]);
  if (error) return { error: "Couldn't update the packet." };
  revalidatePath(`/dashboard/packets/${id}`);
  revalidatePath("/dashboard/network");
  return {};
}

export async function deleteReferralPacket(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("referral_packets").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the packet." };
  revalidatePath("/dashboard/network");
  return {};
}
