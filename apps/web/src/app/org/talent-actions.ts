"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { orgErrorMessage } from "@/lib/orgs";

export type TalentResult = {
  public_id: string;
  headline: string | null;
  summary: string | null;
  roles: string[];
  seniority: string | null;
  years_experience: number | null;
  industries: string[];
  locations: string[];
  work_modes: string[];
  open_to_relocate: boolean;
  needs_sponsorship: boolean;
  salary_min: number | null;
  salary_currency: string;
  skills: string[];
  highlights: string[];
  availability: string;
  updated_at: string;
  intro_status: string | null;
};

export async function searchTalent(orgId: string, query: string, location: string, remoteOnly: boolean): Promise<{ results?: TalentResult[]; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("search_talent", {
    p_org: orgId,
    p_query: query.slice(0, 200),
    p_location: location.slice(0, 100),
    p_remote_only: remoteOnly,
    p_limit: 30,
  });
  if (error) return { error: orgErrorMessage(error.message) };
  return { results: (data ?? []) as TalentResult[] };
}

const introSchema = z.object({
  role_title: z.string().trim().min(2, "Add the role title").max(200),
  role_url: z
    .string()
    .trim()
    .max(500)
    .transform((s) => s || null)
    .pipe(z.string().url("Enter the full job link, starting with https://").nullable()),
  location: z.string().trim().max(200),
  salary_range: z.string().trim().max(100),
  message: z.string().trim().min(20, "Write at least a couple of sentences").max(1500),
});
export type IntroInput = z.input<typeof introSchema>;

export async function requestIntro(orgId: string, publicId: string, input: IntroInput): Promise<{ error?: string }> {
  const parsed = introSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_intro", {
    p_org: orgId,
    p_public_id: publicId,
    p_role_title: d.role_title,
    p_role_url: d.role_url ?? "",
    p_location: d.location,
    p_salary_range: d.salary_range,
    p_message: d.message,
  });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function withdrawIntro(orgId: string, id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("withdraw_intro", { p_id: id });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}
