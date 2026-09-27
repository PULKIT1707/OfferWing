"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveApplicationProfile } from "@/app/dashboard/settings/application-actions";
import { ChipInput, Field, inputClass } from "@/components/onboarding/fields";
import type { ApplicationProfile } from "@/lib/application-profile";

type TextKey = Exclude<keyof ApplicationProfile, "years_experience" | "authorized_countries">;

const GROUPS: { title: string; fields: [TextKey, string, string?][] }[] = [
  {
    title: "You",
    fields: [
      ["first_name", "First name"],
      ["last_name", "Last name"],
      ["preferred_name", "Preferred name", "Optional"],
      ["email", "Email for applications"],
      ["phone", "Phone", "Include your country code, e.g. +1 555 0100"],
    ],
  },
  {
    title: "Where you live",
    fields: [
      ["city", "City"],
      ["region", "State / province"],
      ["country", "Country"],
      ["postal_code", "Postal code"],
    ],
  },
  {
    title: "Links",
    fields: [
      ["linkedin_url", "LinkedIn"],
      ["website_url", "Website"],
      ["github_url", "GitHub"],
      ["portfolio_url", "Portfolio"],
    ],
  },
  {
    title: "Work",
    fields: [
      ["current_company", "Current or most recent company"],
      ["current_title", "Current or most recent title"],
      ["how_heard", "\"How did you hear about us?\" answer", "Usually LinkedIn"],
    ],
  },
];

export function ApplicationProfileForm({ initial, onSaved }: { initial: ApplicationProfile; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (patch: Partial<ApplicationProfile>) => setForm((f) => ({ ...f, ...patch }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setErrors({});
    start(async () => {
      const r = await saveApplicationProfile({ ...form });
      if (r.error) {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
      } else onSaved();
    });
  };

  return (
    <form onSubmit={save} className="space-y-8">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map(([key, label, hint]) => (
              <Field key={key} label={label} hint={hint} error={errors[key]}>
                <input
                  className={inputClass}
                  aria-label={label}
                  value={form[key] ?? ""}
                  onChange={(e) => set({ [key]: e.target.value } as Partial<ApplicationProfile>)}
                  type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                  autoComplete="off"
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Years of professional experience" error={errors.years_experience}>
          <input
            className={inputClass}
            aria-label="Years of professional experience"
            inputMode="numeric"
            value={form.years_experience ?? ""}
            onChange={(e) => set({ years_experience: e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value.replace(/\D/g, "")) || 0)) })}
          />
        </Field>
        <Field label="Countries you can already work in" hint={"Without visa sponsorship. Used to answer \"Are you authorized to work in …?\""} error={errors.authorized_countries}>
          <ChipInput value={form.authorized_countries} onChange={(v) => set({ authorized_countries: v })} placeholder="United States, India…" max={10} />
        </Field>
      </div>
      <p className="rounded-2xl bg-card p-4 text-xs text-muted">
        We never store or fill demographic questions (gender, race, veteran or disability status) or consent boxes. You answer those yourself. Salary, notice period,
        sponsorship and relocation answers come from your Preferences.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-wing px-6 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} Save application details
      </button>
    </form>
  );
}
