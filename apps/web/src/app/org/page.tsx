import { Building2, ChevronRight, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateOrgForm } from "@/components/org/CreateOrgForm";
import { requireUser } from "@/lib/auth";
import { myMemberships } from "@/lib/orgs";

export const metadata: Metadata = { title: "Organizations · Offerwing" };

export default async function OrgsPage() {
  const { supabase, userId } = await requireUser();
  const memberships = (await myMemberships(supabase, userId)).filter((m) => m.role !== "member" || m.kind === "recruiting");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="headline text-3xl font-semibold sm:text-4xl">Organizations</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Give people leaving your company a real job-search wingman, or find candidates who chose to be discovered. Either way, job seekers stay in control of their data.
        </p>
        <div className="mt-8 space-y-3">
          {memberships.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">You aren&apos;t part of any organization yet. Create one, or use an invite link.</div>
          ) : (
            memberships.map((m) => (
              <Link key={m.orgId} href={`/org/${m.orgId}`} className="flex items-center gap-4 rounded-3xl bg-white p-5 hover:ring-1 hover:ring-wing">
                <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: m.brandColor ?? "var(--wing)" }}>
                  {m.kind === "outplacement" ? <Users className="size-5" /> : <Search className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-sm text-muted">
                    {m.kind === "outplacement" ? "Outplacement program" : m.verified ? "Recruiting team · verified" : "Recruiting team · awaiting verification"} · {m.role}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            ))
          )}
        </div>
      </div>
      <aside className="h-fit rounded-3xl bg-white p-6">
        <p className="flex items-center gap-2 font-semibold"><Building2 className="size-5 text-wing" /> New organization</p>
        <CreateOrgForm />
      </aside>
    </div>
  );
}
