import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Provider } from "@/lib/onboarding";

export type Sponsor = { orgId: string; name: string; brandColor: string | null; provider: Provider; endsAt: string | null };

type Row = { organizations: { id: string; name: string; kind: string; brand_color: string | null; ai_provider: Provider | null; sponsorship_ends_at: string | null } | null };

// The outplacement organization paying for this member's AI, if the sponsorship is active.
// Works with the user's own client (RLS) and with the service role (cron).
export async function activeSponsor(supabase: SupabaseClient, userId: string): Promise<Sponsor | null> {
  const { data } = await supabase
    .from("org_members")
    .select("organizations(id, name, kind, brand_color, ai_provider, sponsorship_ends_at)")
    .eq("user_id", userId)
    .eq("role", "member");
  const today = new Date().toISOString().slice(0, 10);
  const org = ((data ?? []) as unknown as Row[])
    .map((r) => r.organizations)
    .find((o) => o?.kind === "outplacement" && o.ai_provider && (!o.sponsorship_ends_at || o.sponsorship_ends_at >= today));
  return org ? { orgId: org.id, name: org.name, brandColor: org.brand_color, provider: org.ai_provider!, endsAt: org.sponsorship_ends_at } : null;
}

export type Membership = { orgId: string; name: string; kind: "outplacement" | "recruiting"; role: "owner" | "admin" | "member"; shareProgress: boolean; brandColor: string | null; verified: boolean };

export async function myMemberships(supabase: SupabaseClient, userId: string): Promise<Membership[]> {
  const { data } = await supabase
    .from("org_members")
    .select("role, share_progress, organizations(id, name, kind, brand_color, verified)")
    .eq("user_id", userId)
    .order("joined_at");
  return ((data ?? []) as unknown as { role: Membership["role"]; share_progress: boolean; organizations: { id: string; name: string; kind: Membership["kind"]; brand_color: string | null; verified: boolean } | null }[])
    .filter((r) => r.organizations)
    .map((r) => ({
      orgId: r.organizations!.id,
      name: r.organizations!.name,
      kind: r.organizations!.kind,
      role: r.role,
      shareProgress: r.share_progress,
      brandColor: r.organizations!.brand_color,
      verified: r.organizations!.verified,
    }));
}

// Friendly text for errors raised by the organization SQL functions.
export function orgErrorMessage(message: string | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("invite invalid")) return "This invite link has expired, was turned off or has been used up. Ask for a new one.";
  if (message.includes("no seats left")) return "This organization has no seats left. Ask its admin to free one up or add seats.";
  if (message.includes("already sponsored")) return "You're already part of another sponsored outplacement program. Leave it first in Settings.";
  if (message.includes("too many organizations")) return "You can own up to 5 organizations.";
  if (message.includes("not verified")) return "Your recruiting team isn't verified yet. Offerwing verifies teams before they can search candidates.";
  if (message.includes("profile unavailable")) return "This candidate is no longer available.";
  if (message.includes("daily intro limit")) return "Your team has reached today's limit of 25 intro requests.";
  if (message.includes("duplicate key")) return "You've already sent this candidate an intro request for this role.";
  if (message.includes("not allowed")) return "You don't have access to do that.";
  return "Something went wrong. Please try again.";
}
