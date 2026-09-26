"use client";

import { HandCoins, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOffer, planNegotiation, saveOffer } from "@/app/dashboard/interviews/actions";
import { firstYearCash, type Offer } from "@/lib/agents/negotiation";
import { CURRENCIES } from "@/lib/onboarding";
import { inputClass } from "@/components/onboarding/fields";
import { CopyButton } from "./CopyButton";
import { Button, Card, label, Modal } from "./ui";

type JobOption = { id: string; title: string; company: string };
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(/[^\d]/g, "")))));
const money = (n: number | null, cur: string) => (n == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n));
const STATUS = [["pending", "Deciding"], ["negotiating", "Negotiating"], ["accepted", "Accepted"], ["declined", "Declined"]] as const;

function OfferForm({ offer, jobs, onDone }: { offer?: Offer; jobs: JobOption[]; onDone: () => void }) {
  const [v, setV] = useState({
    job_id: offer?.job_id ?? null,
    company: offer?.company ?? "",
    title: offer?.title ?? "",
    currency: offer?.currency ?? "USD",
    base_salary: offer?.base_salary ?? null,
    bonus_target: offer?.bonus_target ?? null,
    sign_on: offer?.sign_on ?? null,
    equity: offer?.equity ?? "",
    benefits: offer?.benefits ?? "",
    work_mode: offer?.work_mode ?? "",
    deadline: offer?.deadline ?? "",
    status: offer?.status ?? "pending",
    notes: offer?.notes ?? "",
  });
  const set = (p: Partial<typeof v>) => setV((prev) => ({ ...prev, ...p }));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const blank = (s: string) => (s.trim() ? s : null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveOffer(offer?.id ?? null, { ...v, equity: blank(v.equity), benefits: blank(v.benefits), work_mode: blank(v.work_mode), deadline: blank(v.deadline), notes: blank(v.notes) });
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      {!offer && jobs.length > 0 && (
        <div>
          <label className={label} htmlFor="of-job">From your pipeline</label>
          <select
            id="of-job"
            className={inputClass}
            value={v.job_id ?? ""}
            onChange={(e) => {
              const j = jobs.find((x) => x.id === e.target.value);
              set({ job_id: j?.id ?? null, ...(j ? { company: j.company, title: j.title } : {}) });
            }}
          >
            <option value="">Not in my pipeline</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.company}</option>)}
          </select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="of-co">Company</label><input id="of-co" className={inputClass} value={v.company} onChange={(e) => set({ company: e.target.value })} /></div>
        <div><label className={label} htmlFor="of-ti">Title</label><input id="of-ti" className={inputClass} value={v.title} onChange={(e) => set({ title: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><label className={label} htmlFor="of-base">Base</label><input id="of-base" inputMode="numeric" className={inputClass} value={v.base_salary ?? ""} onChange={(e) => set({ base_salary: num(e.target.value) })} /></div>
        <div><label className={label} htmlFor="of-bonus">Target bonus</label><input id="of-bonus" inputMode="numeric" className={inputClass} value={v.bonus_target ?? ""} onChange={(e) => set({ bonus_target: num(e.target.value) })} /></div>
        <div><label className={label} htmlFor="of-sign">Sign-on</label><input id="of-sign" inputMode="numeric" className={inputClass} value={v.sign_on ?? ""} onChange={(e) => set({ sign_on: num(e.target.value) })} /></div>
        <div><label className={label} htmlFor="of-cur">Currency</label><select id="of-cur" className={inputClass} value={v.currency} onChange={(e) => set({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="of-eq">Equity</label><input id="of-eq" className={inputClass} value={v.equity} onChange={(e) => set({ equity: e.target.value })} placeholder="e.g. 8,000 RSUs over 4 years, 1-year cliff" /></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={label} htmlFor="of-wm">Work mode</label><input id="of-wm" className={inputClass} value={v.work_mode} onChange={(e) => set({ work_mode: e.target.value })} placeholder="Remote" /></div>
        <div><label className={label} htmlFor="of-dl">Deadline</label><input id="of-dl" type="date" className={inputClass} value={v.deadline} onChange={(e) => set({ deadline: e.target.value })} /></div>
        <div><label className={label} htmlFor="of-st">Status</label><select id="of-st" className={inputClass} value={v.status} onChange={(e) => set({ status: e.target.value as Offer["status"] })}>{STATUS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="of-ben">Benefits</label><input id="of-ben" className={inputClass} value={v.benefits} onChange={(e) => set({ benefits: e.target.value })} placeholder="Health, 401k match, learning budget…" /></div>
      <div><label className={label} htmlFor="of-no">Notes</label><textarea id="of-no" rows={2} className={inputClass} value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end"><Button disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save offer</Button></div>
    </form>
  );
}

function PlanView({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const p = offer.negotiation;
  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!p ? (
        <Button className="w-full" disabled={pending} onClick={() => start(async () => { const r = await planNegotiation(offer.id); if (r.error) setError(r.error); else router.refresh(); })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {pending ? "Writing your plan…" : "Write my negotiation plan"}
        </Button>
      ) : (
        <>
          <p className="text-sm">{p.assessment}</p>
          <div className="rounded-2xl bg-wing/5 p-4 text-sm">
            <p className="font-semibold text-wing">Ask for: {p.ask.base_salary}</p>
            {p.ask.other.length > 0 && <ul className="mt-1 list-disc pl-5">{p.ask.other.map((x) => <li key={x}>{x}</li>)}</ul>}
            <p className="mt-2 text-muted">{p.ask.rationale}</p>
          </div>
          {p.leverage.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Your leverage</p><ul className="mt-1 list-disc pl-5 text-sm">{p.leverage.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p><CopyButton text={p.email_script} /></div>
            <p className="mt-2 whitespace-pre-line text-sm">{p.email_script}</p>
          </div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">On a call</p><ul className="mt-1 list-disc pl-5 text-sm">{p.call_talking_points.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">If they say no</p><ul className="mt-1 list-disc pl-5 text-sm">{p.if_they_say_no.map((x) => <li key={x}>{x}</li>)}</ul></div>
          {p.risks.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Watch out for</p><ul className="mt-1 list-disc pl-5 text-sm">{p.risks.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          <button className="w-full text-center text-xs text-muted hover:text-wing" disabled={pending} onClick={() => start(async () => { const r = await planNegotiation(offer.id); if (r.error) setError(r.error); else router.refresh(); })}>
            {pending ? "Rewriting…" : "Rewrite plan"}
          </button>
        </>
      )}
      <p className="text-xs text-muted">Offerwing has no live salary data. Verify ranges with levels data, recruiters and peers before you ask.</p>
    </div>
  );
}

export function Offers({ offers, jobs }: { offers: Offer[]; jobs: JobOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const [, start] = useTransition();
  const planOffer = offers.find((o) => o.id === planning);
  const best = Math.max(...offers.map((o) => firstYearCash(o) ?? 0));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><HandCoins className="size-4 text-wing" /> Offers</h2>
          <p className="mt-1 text-sm text-muted">Compare offers side by side and plan your negotiation.</p>
        </div>
        <Button className="px-3 py-2 text-xs" onClick={() => setEditing("new")}><Plus className="size-3.5" /> Add offer</Button>
      </div>
      {offers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No offers yet. When one arrives, add it here for a comparison and a negotiation plan.</p>
      ) : (
        <div className="-mx-2 mt-4 overflow-x-auto px-2">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-semibold">Offer</th>
                <th className="py-2 pr-3 font-semibold">Base</th>
                <th className="py-2 pr-3 font-semibold">1st-year cash</th>
                <th className="py-2 pr-3 font-semibold">Equity</th>
                <th className="py-2 pr-3 font-semibold">Deadline</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {offers.map((o) => {
                const cash = firstYearCash(o);
                return (
                  <tr key={o.id}>
                    <td className="py-3 pr-3">
                      <p className="font-medium">{o.company}</p>
                      <p className="text-xs text-muted">{o.title} · {STATUS.find(([s]) => s === o.status)?.[1]}</p>
                    </td>
                    <td className="py-3 pr-3">{money(o.base_salary, o.currency)}</td>
                    <td className={`py-3 pr-3 ${cash != null && cash === best && offers.length > 1 ? "font-semibold text-emerald-700" : ""}`}>{money(cash, o.currency)}</td>
                    <td className="max-w-[180px] py-3 pr-3 text-xs text-muted">{o.equity ?? "—"}</td>
                    <td className="py-3 pr-3 text-xs">{o.deadline ?? "—"}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button className="px-2.5 py-1.5 text-xs" onClick={() => setPlanning(o.id)}><Sparkles className="size-3.5" /> {o.negotiation ? "Plan" : "Negotiate"}</Button>
                        <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing(o)} aria-label={`Edit ${o.company} offer`}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => confirm(`Delete the ${o.company} offer?`) && start(async () => { await deleteOffer(o.id); router.refresh(); })} aria-label={`Delete ${o.company} offer`}><Trash2 className="size-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">First-year cash = base + target bonus + sign-on. Equity is listed separately because its value is uncertain.</p>
        </div>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add an offer" : "Edit offer"}>
        {editing !== null && <OfferForm key={editing === "new" ? "new" : editing.id} offer={editing === "new" ? undefined : editing} jobs={jobs} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
      <Modal open={!!planOffer} onClose={() => setPlanning(null)} title={planOffer ? `Negotiation plan · ${planOffer.company}` : ""}>
        {planOffer && <PlanView offer={planOffer} />}
      </Modal>
    </Card>
  );
}
