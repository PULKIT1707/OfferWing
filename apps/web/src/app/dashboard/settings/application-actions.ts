"use server";

import { revalidatePath } from "next/cache";
import { applicationProfileSchema, type ApplicationProfileInput } from "@/lib/application-profile";
import { requireUser } from "@/lib/auth";

export async function saveApplicationProfile(input: ApplicationProfileInput): Promise<{ error?: string; fieldErrors?: Record<string, string> }> {
  const parsed = applicationProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("application_profiles").upsert({ user_id: userId, ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings");
  return {};
}
