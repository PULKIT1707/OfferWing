import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TimeZoneSync } from "@/components/dashboard/TimeZoneSync";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { supabase, userId, email } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("full_name, onboarding_step, time_zone").eq("id", userId).single();
  if (profile?.onboarding_step !== "done") redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-card lg:flex-row">
      <TimeZoneSync current={profile.time_zone} />
      <Sidebar name={profile.full_name} email={email} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
