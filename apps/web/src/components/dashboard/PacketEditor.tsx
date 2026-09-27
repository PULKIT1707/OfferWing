"use client";

import { AlertTriangle, ArrowLeft, Eye, Link2, Loader2, Plus, RotateCcw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteReferralPacket, saveReferralPacket, setPacketStatus } from "@/app/dashboard/packets/actions";
import type { FitPoint } from "@/lib/agents/referral-packet";
import type { Verification } from "@/lib/agents/truthfulness";
import { inputClass } from "@/components/onboarding/fields";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui";

export type PacketRow = {
  id: string;
  token: string;
  status: "generating" | "draft" | "live" | "revoked" | "failed";
  referrer_name: string | null;
  candidate_name: string | null;
  headline: string | null;
  fit_points: FitPoint[];
  blurb: string | null;
  note_to_referrer: string | null;
  include_resume: boolean;
  kit_id: string | null;
  verification: Verification | null;
  error: string | null;
  views: number;
  last_viewed_at: string | null;
  expires_at: string;
  created_at: string;
  jobs: { id: string; title: string; company: string } | null;
};

function Polling() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

const STATUS: Record<PacketRow["status"], [string, string]> = {
  generating: ["Writing…", "bg-wing/10 text-wing"],
  draft: ["Draft · not shared", "bg-card text-muted"],
  live: ["Live", "bg-emerald-50 text-emerald-700"],
  revoked: ["Link turned off", "bg-red-50 text-red-700"],
  failed: ["Failed", "bg-red-50 text-red-700"],
};

export function PacketEditor({ packet, generating, shareUrl }: { packet: PacketRow; generating: boolean; shareUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({
    referrer_name: packet.referrer_name ?? "",
    headline: packet.headline ?? "",
    fit_points: packet.fit_points,
    blurb: packet.blurb ?? "",
    note_to_referrer: packet.note_to_referrer ?? "",
    include_resume: packet.include_resume,
  });
  // Adopt server data when the packet finishes generating.
  const [seen, setSeen] = useState(packet.status);
  if (seen !== packet.status) {
    setSeen(packet.status);
    setForm({
      referrer_name: packet.referrer_name ?? "",
      headline: packet.headline ?? "",
      fit_points: packet.fit_points,
      blurb: packet.blurb ?? "",
      note_to_referrer: packet.note_to_referrer ?? "",
      include_resume: packet.include_resume,
    });
  }
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const job = packet.jobs;
  const removed = packet.verification?.flagged.filter((f) => f.where.startsWith("Fit point") && f.reasons.some((r) => r.startsWith("Supporting quote"))) ?? [];
  const numberFlags = packet.verification?.flagged.filter((f) => f.reasons.some((r) => r.startsWith("Number"))) ?? [];

  const save = (publish: boolean) =>
    start(async () => {
      setError(undefined);
      const r = await saveReferralPacket(packet.id, form, publish);
      if (r.error) setError(r.error);
      router.refresh();
    });
  const status = (s: "revoked" | "draft") =>
    start(async () => {
      setError(undefined);
      const r = await setPacketStatus(packet.id, s);
      if (r.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-4xl">
      {generating && <Polling />}
      <Link href="/dashboard/network" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Referrals & network
      </Link>
      <div className="mt-3 mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-wing">Referral packet</p>
          <h1 className="headline mt-1 text-3xl font-semibold sm:text-4xl">{job?.title ?? "Job"}</h1>
          <p className="mt-1 text-muted">
            {job?.company}
            {packet.referrer_name ? ` · for ${packet.referrer_name}` : ""}
          </p>
        </div>
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS[generating ? "generating" : packet.status][1]}`}>
          {STATUS[generating ? "generating" : packet.status][0]}
        </span>
      </div>

      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {generating ? (
        <div className="rounded-3xl bg-white p-10 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-wing" />
          <p className="mt-4 font-medium">Writing your referral packet…</p>
          <p className="mt-1 text-sm text-muted">Usually 20 to 60 seconds. Every reason is then checked against your documents.</p>
        </div>
      ) : packet.status === "failed" || packet.status === "generating" ? (
        <div className="rounded-3xl bg-white p-10 text-center">
          <AlertTriangle className="mx-auto size-7 text-amber-500" />
          <p className="mt-3 font-medium">This packet didn&apos;t finish</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">{packet.error ?? "It took too long and was stopped."} Start a new one from the job&apos;s application kit or Referral Scout.</p>
          <Button variant="ghost" className="mt-5" onClick={() => start(async () => { await deleteReferralPacket(packet.id); router.push("/dashboard/network"); })}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {packet.status === "live" && (
            <div className="rounded-3xl bg-ink p-6 text-white">
              <p className="flex items-center gap-2 font-semibold"><Link2 className="size-5 text-wing-soft" /> Your link is live</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-white/10 px-3 py-2.5 text-sm">{shareUrl}</code>
                <div className="flex gap-2">
                  <CopyButton text={shareUrl} label="Copy link" />
                  <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20">
                    <Eye className="size-3.5" /> Preview
                  </a>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/60">
                Opened {packet.views} time{packet.views === 1 ? "" : "s"}
                {packet.last_viewed_at ? `, last on ${new Date(packet.last_viewed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}. Expires{" "}
                {new Date(packet.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Paste the link into your referral ask.
              </p>
            </div>
          )}

          {(removed.length > 0 || numberFlags.length > 0) && (
            <div className="rounded-3xl bg-amber-50 p-5 text-sm text-amber-950">
              {removed.length > 0 && (
                <p>
                  <span className="font-medium">We removed {removed.length} reason{removed.length === 1 ? "" : "s"}</span> we couldn&apos;t trace to your documents: {removed.map((r) => `“${r.text}”`).join(" ")}
                </p>
              )}
              {numberFlags.filter((f) => !f.where.startsWith("Fit point") || !removed.includes(f)).map((f, i) => (
                <p key={i} className="mt-1">
                  <span className="font-medium">{f.where}:</span> {f.reasons.join(" · ")}. Check it before sharing.
                </p>
              ))}
            </div>
          )}
          {removed.length === 0 && numberFlags.length === 0 && (
            <p className="flex items-center gap-2 rounded-3xl bg-emerald-50 p-5 text-sm text-emerald-900">
              <ShieldCheck className="size-5 shrink-0" /> Every reason traces back to your documents. Still read it through before you share it.
            </p>
          )}

          <section className="space-y-5 rounded-3xl bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Who it&apos;s for</span>
                <input className={inputClass} value={form.referrer_name} onChange={(e) => set({ referrer_name: e.target.value })} placeholder="Their first name (optional)" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Headline</span>
                <input className={inputClass} value={form.headline} onChange={(e) => set({ headline: e.target.value })} />
              </label>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">Why you fit</p>
              <div className="space-y-2">
                {form.fit_points.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <textarea
                      className={`${inputClass} min-h-16`}
                      value={f.point}
                      onChange={(e) => set({ fit_points: form.fit_points.map((x, j) => (j === i ? { ...x, point: e.target.value } : x)) })}
                    />
                    <button type="button" aria-label="Remove this reason" onClick={() => set({ fit_points: form.fit_points.filter((_, j) => j !== i) })} className="rounded-lg p-2 text-muted hover:bg-card hover:text-red-600">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                {form.fit_points.length < 6 && (
                  <button type="button" onClick={() => set({ fit_points: [...form.fit_points, { point: "", evidence: "" }] })} className="inline-flex items-center gap-1 text-xs font-medium text-wing hover:underline">
                    <Plus className="size-3.5" /> Add a reason
                  </button>
                )}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Blurb for their referral form</span>
              <span className="mb-1.5 block text-xs text-muted">They can paste this straight into their company&apos;s referral tool.</span>
              <textarea className={`${inputClass} min-h-32`} value={form.blurb} onChange={(e) => set({ blurb: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Your note to them</span>
              <textarea className={`${inputClass} min-h-24`} value={form.note_to_referrer} onChange={(e) => set({ note_to_referrer: e.target.value })} />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--wing)]" checked={form.include_resume} disabled={!packet.kit_id} onChange={(e) => set({ include_resume: e.target.checked })} />
              {packet.kit_id ? "Include my tailored resume (.docx) for download" : "No tailored resume yet: create an application kit for this job to attach one"}
            </label>
          </section>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              {packet.status === "live" ? (
                <Button variant="ghost" onClick={() => status("revoked")} disabled={pending}><X className="size-4" /> Turn off link</Button>
              ) : packet.status === "revoked" ? (
                <Button variant="ghost" onClick={() => status("draft")} disabled={pending}><RotateCcw className="size-4" /> Restore as draft</Button>
              ) : null}
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => confirm("Delete this referral packet? Its link stops working.") && start(async () => { await deleteReferralPacket(packet.id); router.push("/dashboard/network"); })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => save(false)} disabled={pending}>Save</Button>
              <Button onClick={() => save(true)} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {packet.status === "live" ? "Save & keep live" : "Publish link"}
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-muted">The link is unlisted and hidden from search engines. Anyone with it can view the page until it expires or you turn it off.</p>
        </div>
      )}
    </div>
  );
}
