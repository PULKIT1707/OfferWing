"use client";

import { KeyRound, Link2, Loader2, Lock, Plus, Trash2, TrendingUp, UserMinus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { createInvite, removeMember, removeOrgAiKey, revokeInvite, setOrgAiKey, updateOrganization } from "@/app/org/actions";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { inputClass } from "@/components/onboarding/fields";
import { inviteActive, sponsorshipEnded } from "@/lib/invites";
import { PROVIDERS, type Provider } from "@/lib/onboarding";

export type Invite = { id: string; code: string; role: "admin" | "member"; label: string | null; max_uses: number; uses: number; expires_at: string; revoked_at: string | null; created_at: string };
export type Member = { user_id: string; full_name: string | null; email: string; role: "owner" | "admin" | "member"; share_progress: boolean; joined_at: string };
type Person = { name: string | null; email: string; joined_at: string; last_active: string | null; onboarded: boolean; jobs_saved: number; applied: number; interviewing: number; offers: number; placed: boolean };
export type Progress = {
  members: number;
  aggregate: { onboarded: number; active_7d: number; applied: number; interviewing: number; with_offer: number; placed: number } | null;
  people: Person[];
};

function Panel({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">{icon} {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string } | void>, after?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (r && r.error) setError(r.error);
      else after?.();
      router.refresh();
    });
  return { pending, error, run };
}

const Err = ({ error }: { error?: string }) => (error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null);
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

export function ProgressCard({ progress }: { progress: Progress | null }) {
  if (!progress) return null;
  const a = progress.aggregate;
  const stats: [string, number][] = a
    ? [
        ["Set up", a.onboarded],
        ["Active this week", a.active_7d],
        ["Applications", a.applied],
        ["Interviewing", a.interviewing],
        ["With an offer", a.with_offer],
        ["Placed", a.placed],
      ]
    : [];
  return (
    <Panel title="Program progress" icon={<TrendingUp className="size-5 text-wing" />}>
      {a ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-card p-4">
              <p className="text-2xl font-semibold">{n}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-card p-4 text-sm text-muted">
          <Lock className="mt-0.5 size-4 shrink-0" /> Program totals appear once 5 people have joined ({progress.members} so far), so no one can be singled out.
        </p>
      )}
      <p className="mt-6 text-sm font-medium">People sharing their progress with you ({progress.people.length})</p>
      <p className="mt-0.5 text-xs text-muted">Sharing is off by default. Each person chooses in their own settings, and can stop at any time.</p>
      {progress.people.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">Person</th>
                <th className="py-2 font-medium">Last active</th>
                <th className="py-2 font-medium">Saved</th>
                <th className="py-2 font-medium">Applied</th>
                <th className="py-2 font-medium">Interviewing</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {progress.people.map((p) => (
                <tr key={p.email} className="border-t border-line">
                  <td className="py-2.5">
                    <p className="font-medium">{p.name ?? p.email}</p>
                    <p className="text-xs text-muted">{p.email}</p>
                  </td>
                  <td className="py-2.5">{date(p.last_active)}</td>
                  <td className="py-2.5">{p.jobs_saved}</td>
                  <td className="py-2.5">{p.applied}</td>
                  <td className="py-2.5">{p.interviewing}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.placed ? "bg-emerald-50 text-emerald-700" : p.offers ? "bg-wing/10 text-wing" : !p.onboarded ? "bg-amber-50 text-amber-800" : "bg-card text-muted"}`}>
                      {p.placed ? "Placed" : p.offers ? "Has offer" : !p.onboarded ? "Not set up" : "Searching"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function InvitesCard({ orgId, kind, origin, invites }: { orgId: string; kind: "outplacement" | "recruiting"; origin: string; invites: Invite[] }) {
  const { pending, error, run } = useAction();
  const [form, setForm] = useState({ role: "member" as "admin" | "member", label: "", maxUses: kind === "outplacement" ? 25 : 1, days: 30 });
  const [open, setOpen] = useState(false);
  return (
    <Panel
      title="Invite links"
      icon={<Link2 className="size-5 text-wing" />}
      action={
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-medium hover:border-wing hover:text-wing">
          <Plus className="size-3.5" /> New link
        </button>
      }
    >
      {open && (
        <form
          className="mb-5 space-y-3 rounded-2xl bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createInvite(orgId, form), () => setOpen(false));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              Joins as
              <select className={`${inputClass} mt-1`} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "member" }))}>
                <option value="member">{kind === "outplacement" ? "Job seeker (uses a seat)" : "Recruiter (uses a seat)"}</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Label (optional)
              <input className={`${inputClass} mt-1`} value={form.label} placeholder="e.g. March transition, EMEA" onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </label>
            <label className="text-xs font-medium">
              How many people can use it
              <input className={`${inputClass} mt-1`} inputMode="numeric" value={form.maxUses} onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
            </label>
            <label className="text-xs font-medium">
              Valid for (days)
              <input className={`${inputClass} mt-1`} inputMode="numeric" value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value.replace(/\D/g, "")) || 0 }))} />
            </label>
          </div>
          <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />} Create link
          </button>
        </form>
      )}
      {invites.length === 0 ? (
        <p className="text-sm text-muted">No invite links yet. Create one and share it by email or in your HR system.</p>
      ) : (
        <div>
          {invites.map((i) => {
            const url = `${origin}/join/${i.code}`;
            const isActive = inviteActive(i);
            return (
              <div key={i.id} className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {i.label ?? (i.role === "admin" ? "Admin invite" : "Invite")} <span className="text-xs font-normal text-muted">· {i.role}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {i.uses}/{i.max_uses} used · {i.revoked_at ? "turned off" : isActive || i.uses < i.max_uses ? `${isActive ? "expires" : "expired"} ${date(i.expires_at)}` : "used up"}
                  </p>
                </div>
                {isActive && (
                  <div className="flex gap-2">
                    <CopyButton text={url} label="Copy link" />
                    <button onClick={() => run(() => revokeInvite(orgId, i.id))} disabled={pending} className="rounded-lg px-2 text-xs text-muted hover:text-red-600">Turn off</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Err error={error} />
    </Panel>
  );
}

export function MembersCard({ orgId, members, me }: { orgId: string; members: Member[]; me: string }) {
  const { pending, error, run } = useAction();
  return (
    <Panel title={`People (${members.length})`} icon={<Users className="size-5 text-wing" />}>
      <div>
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.full_name ?? m.email}</p>
              <p className="truncate text-xs text-muted">{m.email} · {m.role} · joined {date(m.joined_at)}</p>
            </div>
            {m.role === "member" && m.user_id !== me && (
              <button
                aria-label={`Remove ${m.full_name ?? m.email}`}
                disabled={pending}
                onClick={() => confirm(`Remove ${m.full_name ?? m.email}? They keep their Offerwing account and data, but lose sponsored AI.`) && run(() => removeMember(orgId, m.user_id))}
                className="rounded-lg p-2 text-muted hover:bg-card hover:text-red-600"
              >
                <UserMinus className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Err error={error} />
    </Panel>
  );
}

export function SponsorKeyCard({ orgId, provider, last4, endsAt }: { orgId: string; provider: string | null; last4: string | null; endsAt: string | null }) {
  const { pending, error, run } = useAction();
  const [p, setP] = useState<Provider>("anthropic");
  const [key, setKey] = useState("");
  const ended = sponsorshipEnded(endsAt);
  return (
    <Panel title="Sponsored AI" icon={<KeyRound className="size-5 text-wing" />}>
      <p className="text-sm text-muted">
        Your people&apos;s agents run on your organization&apos;s AI key, with no daily limits. Set a monthly spend limit on the key at your provider. The key is encrypted in a vault and never shown again.
      </p>
      {provider ? (
        <div className="mt-4 rounded-2xl bg-card p-4 text-sm">
          <p className="font-medium">{PROVIDERS.find(([id]) => id === provider)?.[1]} key ending …{last4}</p>
          <p className="mt-1 text-xs text-muted">{ended ? `Sponsorship ended ${date(endsAt)}.` : endsAt ? `Sponsored until ${date(endsAt)}.` : "Sponsorship active."}</p>
          <button disabled={pending} onClick={() => confirm("Remove the key? Your people fall back to free Starter limits.") && run(() => removeOrgAiKey(orgId))} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
            <Trash2 className="size-3.5" /> Remove key
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setOrgAiKey(orgId, p, key), () => setKey(""));
          }}
        >
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map(([id, label]) => (
              <button type="button" key={id} onClick={() => setP(id)} aria-pressed={p === id} className={`rounded-full border px-3 py-1.5 text-xs ${p === id ? "border-wing bg-wing text-white" : "border-line"}`}>
                {label}
              </button>
            ))}
          </div>
          <input className={`${inputClass} font-mono`} type="password" autoComplete="off" placeholder={PROVIDERS.find(([id]) => id === p)?.[2]} value={key} onChange={(e) => setKey(e.target.value)} />
          <button disabled={pending || key.trim().length < 20} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-2.5 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />} Verify & save key
          </button>
        </form>
      )}
      <Err error={error} />
    </Panel>
  );
}

export function OrgDetailsCard({ org }: { org: { id: string; kind: string; name: string; website: string | null; brand_color: string | null } }) {
  const { pending, error, run } = useAction();
  const [form, setForm] = useState({ name: org.name, website: org.website ?? "", brand_color: org.brand_color ?? "" });
  const [saved, setSaved] = useState(false);
  return (
    <Panel title="Details" icon={<span className="size-5 rounded-full" style={{ background: form.brand_color || "var(--wing)" }} />}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          run(() => updateOrganization(org.id, form), () => setSaved(true));
        }}
      >
        <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-label="Name" />
        <input className={inputClass} value={form.website} placeholder="Website" onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} aria-label="Website" />
        <input className={inputClass} value={form.brand_color} placeholder="Brand color, e.g. #6242ff" onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))} aria-label="Brand color" />
        {org.kind === "recruiting" && <p className="text-xs text-muted">Renaming a verified team sends it back for verification.</p>}
        <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:border-wing hover:text-wing disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />} {saved ? "Saved" : "Save"}
        </button>
      </form>
      <Err error={error} />
    </Panel>
  );
}
