import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TimeZoneSync } from "@/components/dashboard/TimeZoneSync";
import { requireUser } from "@/lib/auth";
import { activeSponsor, myMemberships } from "@/lib/orgs";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { supabase, userId, email } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, onboarding_step, time_zone").eq("id", userId).single();
  if (profile?.onboarding_step !== "done") redirect("/onboarding");
  const [sponsor, memberships, { count: pendingIntros }] = await Promise.all([
    activeSponsor(supabase, userId),
    myMemberships(supabase, userId),
    supabase.from("intro_requests").select("id", { count: "exact", head: true }).eq("talent_user_id", userId).eq("status", "pending"),
  ]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-card lg:flex-row">
      <TimeZoneSync current={profile.time_zone} />
      <Sidebar
        name={profile.full_name}
        email={email}
        sponsor={sponsor}
        pendingIntros={pendingIntros ?? 0}
        hasOrgs={memberships.some((m) => m.role !== "member" || m.kind === "recruiting")}
      />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
