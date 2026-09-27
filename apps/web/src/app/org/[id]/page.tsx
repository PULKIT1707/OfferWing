import { ArrowLeft, BadgeCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitesCard, MembersCard, OrgDetailsCard, ProgressCard, SponsorKeyCard, type Invite, type Member, type Progress } from "@/components/org/OrgConsole";
import { IntroList, TalentSearch, type OrgIntro } from "@/components/org/Recruiting";
import { appOrigin } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Organization · Offerwing" };

type Org = {
  id: string;
  kind: "outplacement" | "recruiting";
  name: string;
  website: string | null;
  brand_color: string | null;
  seat_limit: number;
  sponsorship_ends_at: string | null;
  verified: boolean;
  ai_provider: string | null;
  ai_key_last4: string | null;
};

export default async function OrgPage(props: PageProps<"/org/[id]">) {
  const { id } = await props.params;
  const { supabase, userId } = await requireUser();
  const [{ data: org }, { data: me }] = await Promise.all([
    supabase.from("organizations").select("id, kind, name, website, brand_color, seat_limit, sponsorship_ends_at, verified, ai_provider, ai_key_last4").eq("id", id).maybeSingle(),
    supabase.from("org_members").select("role").eq("org_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!org || !me) notFound();
  const o = org as Org;
  const admin = me.role === "owner" || me.role === "admin";

  const [invites, members, progress, intros] = await Promise.all([
    admin ? supabase.from("org_invites").select("id, code, role, label, max_uses, uses, expires_at, revoked_at, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(50) : null,
    admin ? supabase.rpc("org_member_list", { p_org: id }) : null,
    admin && o.kind === "outplacement" ? supabase.rpc("org_progress", { p_org: id }) : null,
    o.kind === "recruiting" ? supabase.rpc("org_intros", { p_org: id }) : null,
  ]);
  const origin = await appOrigin();
  const seatsUsed = ((members?.data ?? []) as Member[]).filter((m) => m.role === "member").length;

  return (
    <div>
      <Link href="/org" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Organizations
      </Link>
      <div className="mt-3 mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: o.brand_color ?? "var(--wing)" }}>{o.kind === "outplacement" ? "Outplacement program" : "Recruiting team"}</p>
          <h1 className="headline mt-1 text-3xl font-semibold sm:text-4xl">{o.name}</h1>
        </div>
        {o.kind === "outplacement" ? (
          <p className="text-sm text-muted">
            {seatsUsed} of {o.seat_limit} seats used{o.seat_limit - seatsUsed <= 2 ? " · contact Offerwing to add seats" : ""}
          </p>
        ) : o.verified ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"><BadgeCheck className="size-4" /> Verified</p>
        ) : (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"><Clock className="size-4" /> Awaiting verification</p>
        )}
      </div>

      {o.kind === "outplacement" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {admin && <ProgressCard progress={(progress?.data ?? null) as Progress | null} />}
            {admin && <InvitesCard orgId={id} kind={o.kind} origin={origin} invites={(invites?.data ?? []) as Invite[]} />}
            {admin && <MembersCard orgId={id} members={(members?.data ?? []) as Member[]} me={userId} />}
          </div>
          <div className="space-y-6">
            {admin && <SponsorKeyCard orgId={id} provider={o.ai_provider} last4={o.ai_key_last4} endsAt={o.sponsorship_ends_at} />}
            {admin && <OrgDetailsCard org={o} />}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {o.verified ? (
              <TalentSearch orgId={id} />
            ) : (
              <div className="rounded-3xl bg-white p-6">
                <p className="font-semibold">Verification in progress</p>
                <p className="mt-2 text-sm text-muted">
                  Candidates trust Offerwing because only real hiring teams can reach them. We check that {o.name} is a genuine employer or agency and that you work there, usually within
                  two business days. Make sure your website is set, then contact the Offerwing team from your work email to request verification.
                </p>
              </div>
            )}
            <IntroList orgId={id} intros={(intros?.data ?? []) as OrgIntro[]} />
          </div>
          <div className="space-y-6">
            {admin && <InvitesCard orgId={id} kind={o.kind} origin={origin} invites={(invites?.data ?? []) as Invite[]} />}
            {admin && <MembersCard orgId={id} members={(members?.data ?? []) as Member[]} me={userId} />}
            {admin && <OrgDetailsCard org={o} />}
          </div>
        </div>
      )}
    </div>
  );
}
