"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CHANNELS, CONTACT_COLUMNS, JOB_COLUMNS, REFERRAL_STATUSES, RELATIONSHIPS, STAGES, type Contact, type Job } from "@/lib/dashboard";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();
const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^https?:\/\/\S+$/i.test(v), "Enter a full link starting with https://");
const optionalDate = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date");
const enumOf = <T extends string>(values: readonly (readonly [T, ...unknown[]])[] | readonly { id: T }[]) =>
  z.enum(values.map((v) => ("id" in v ? v.id : v[0])) as [T, ...T[]]);

const jobSchema = z.object({
  title: z.string().trim().min(1, "Add the job title").max(200),
  company: z.string().trim().min(1, "Add the company").max(200),
  url: optionalUrl,
  location: optionalText(200),
  stage: enumOf(STAGES).optional(),
  channel: enumOf(CHANNELS).nullable().optional(),
  description: optionalText(30000),
  notes: optionalText(5000),
  next_action: optionalText(200),
  next_action_at: optionalDate,
});

const contactSchema = z.object({
  full_name: z.string().trim().min(1, "Add their name").max(200),
  company: optionalText(200),
  title: optionalText(200),
  relationship: enumOf(RELATIONSHIPS),
  strength: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  linkedin_url: optionalUrl,
  referral_status: enumOf(REFERRAL_STATUSES),
  job_id: z.string().uuid().nullable().optional(),
  notes: optionalText(5000),
  last_contacted_at: optionalDate,
  next_follow_up_at: optionalDate,
});

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form.";

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function saveJob(id: string | null, input: unknown): Promise<Result<Job>> {
  const parsed = (id ? jobSchema.partial() : jobSchema).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { supabase, userId } = await requireUser();

  const values: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (id && parsed.data.description !== undefined) {
    const { data: current } = await supabase.from("jobs").select("description").eq("id", id).single();
    if ((current?.description ?? null) !== (parsed.data.description ?? null)) values.fit_score = null;
  }
  if (parsed.data.stage) {
    values.stage_changed_at = new Date().toISOString();
    if (parsed.data.stage === "applied") values.applied_at = new Date().toISOString();
    if (parsed.data.stage === "saved") values.applied_at = null;
  }

  const query = id
    ? supabase.from("jobs").update(values).eq("id", id)
    : supabase.from("jobs").insert({ ...values, user_id: userId });
  const { data, error } = await query.select(JOB_COLUMNS).single();
  if (error || !data) return { ok: false, error: "Couldn't save the job. Please try again." };
  refresh();
  return { ok: true, data: data as Job };
}

export async function deleteJob(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the job." };
  refresh();
  return { ok: true, data: undefined };
}

export async function saveContact(id: string | null, input: unknown): Promise<Result<Contact>> {
  const parsed = (id ? contactSchema.partial() : contactSchema).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { supabase, userId } = await requireUser();

  const values = { ...parsed.data, updated_at: new Date().toISOString() };
  const query = id
    ? supabase.from("contacts").update(values).eq("id", id)
    : supabase.from("contacts").insert({ ...values, user_id: userId });
  const { data, error } = await query.select(CONTACT_COLUMNS).single();
  if (error || !data) return { ok: false, error: "Couldn't save the contact. Please try again." };
  refresh();
  return { ok: true, data: data as Contact };
}

export async function deleteContact(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete the contact." };
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteAccount(confirmation: string): Promise<Result> {
  if (confirmation !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };
  const { supabase, userId } = await requireUser();

  // Remove uploaded files first; the database cascade doesn't reach Storage.
  const { data: docs } = await supabase.from("career_documents").select("storage_path").eq("user_id", userId);
  if (docs?.length) {
    const { error } = await supabase.storage.from("career-docs").remove(docs.map((d) => d.storage_path));
    if (error) return { ok: false, error: "Couldn't delete your files. Nothing was deleted; please try again." };
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: "Couldn't delete your account. Please try again." };
  await supabase.auth.signOut();
  redirect("/");
}
