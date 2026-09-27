"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyProviderKey } from "@/lib/ai-keys";
import { requireUser } from "@/lib/auth";
import { orgErrorMessage } from "@/lib/orgs";
import { PROVIDERS, type Provider } from "@/lib/onboarding";

type Result = { error?: string };

const orgSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((s) => (s && !/^https?:\/\//i.test(s) ? `https://${s}` : s) || null)
    .pipe(z.string().url("Enter a valid website").nullable()),
});

export async function createOrganization(kind: "outplacement" | "recruiting", name: string, website: string): Promise<Result> {
  const parsed = orgSchema.safeParse({ name, website });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_organization", { p_kind: kind, p_name: parsed.data.name, p_website: parsed.data.website ?? "" });
  if (error || !data) return { error: orgErrorMessage(error?.message) };
  redirect(`/org/${data}`);
}

export async function updateOrganization(orgId: string, input: { name: string; website: string; brand_color: string }): Promise<Result> {
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const color = input.brand_color.trim();
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return { error: "Brand color must look like #6242ff" };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name, website: parsed.data.website, brand_color: color || null, updated_at: new Date().toISOString() })
    .eq("id", orgId);
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function createInvite(orgId: string, input: { role: "admin" | "member"; label: string; maxUses: number; days: number }): Promise<Result> {
  const maxUses = Math.round(input.maxUses);
  const days = Math.round(input.days);
  if (!(maxUses >= 1 && maxUses <= 10000)) return { error: "Uses must be between 1 and 10,000." };
  if (!(days >= 1 && days <= 90)) return { error: "Invites can last 1 to 90 days." };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("org_invites").insert({
    org_id: orgId,
    role: input.role,
    label: input.label.trim().slice(0, 120) || null,
    max_uses: maxUses,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    created_by: userId,
  });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("org_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).eq("org_id", orgId);
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function setOrgAiKey(orgId: string, provider: Provider, key: string): Promise<Result> {
  if (!PROVIDERS.some(([p]) => p === provider)) return { error: "Choose a provider." };
  const trimmed = key.trim();
  const check = await verifyProviderKey(provider, trimmed);
  if (!check.ok) return { error: check.error };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_org_ai_key", { p_org: orgId, p_provider: provider, p_key: trimmed });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function removeOrgAiKey(orgId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_org_ai_key", { p_org: orgId });
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function removeMember(orgId: string, memberId: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", memberId);
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath(`/org/${orgId}`);
  return {};
}

export async function joinOrganization(code: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { data: orgId, error } = await supabase.rpc("redeem_org_invite", { p_code: code });
  if (error || !orgId) return { error: orgErrorMessage(error?.message) };
  const { data: m } = await supabase.from("org_members").select("role, organizations(kind)").eq("org_id", orgId).eq("user_id", userId).single();
  const kind = (m?.organizations as unknown as { kind: string } | null)?.kind;
  revalidatePath("/dashboard", "layout");
  // Job seekers go to their dashboard; admins and recruiters to the organization.
  redirect(m?.role === "member" && kind === "outplacement" ? "/dashboard?joined=1" : `/org/${orgId}`);
}

export async function leaveOrganization(orgId: string): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function setShareProgress(orgId: string, share: boolean): Promise<Result> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("org_members").update({ share_progress: share }).eq("org_id", orgId).eq("user_id", userId);
  if (error) return { error: orgErrorMessage(error.message) };
  revalidatePath("/dashboard/settings");
  return {};
}
