"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { saveBasics, saveCareer, saveLinkedin, savePreferences, type ActionResult } from "@/app/onboarding/actions";
import { CURRENCIES, DAILY_MINUTES, LINKEDIN_TIERS, SENIORITY, WORK_MODES, type SearchProfile } from "@/lib/onboarding";
import { ChipInput, Choice, Field, inputClass, MultiChoice, StepFooter, StepHeader, Toggle } from "./fields";

// `embedded` renders the step inside Settings: no wizard header, "Save changes" instead of "Continue".
export type StepProps = { profile: SearchProfile; onDone: (patch?: Partial<SearchProfile>) => void; onBack?: () => void; embedded?: boolean };

// Field errors stay visible only until the user edits that field.
function useSave<T extends Record<string, unknown>>(values: T) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult & { submitted?: T }>({});
  const run = (action: () => Promise<ActionResult>, onOk: () => void) =>
    start(async () => {
      const r = await action();
      setResult({ ...r, submitted: values });
      if (!r.error && !r.fieldErrors) onOk();
    });
  const fieldError = (...keys: (keyof T & string)[]) => {
    for (const k of keys) {
      const msg = result.fieldErrors?.[k];
      if (msg && JSON.stringify(result.submitted?.[k]) === JSON.stringify(values[k])) return msg;
    }
  };
  return { pending, error: result.error, fieldError, run };
}

const ROLE_SUGGESTIONS = ["Software Engineer", "Product Manager", "Data Scientist", "Product Designer", "Marketing Manager"];
const INDUSTRY_SUGGESTIONS = ["SaaS", "Fintech", "AI / ML", "E-commerce", "Healthcare", "Consulting"];

export function CareerStep({ profile, onDone, embedded }: StepProps) {
  const [v, setV] = useState({
    target_roles: profile.target_roles,
    seniority: profile.seniority,
    industries: profile.industries,
    search_mode: profile.search_mode,
    urgency: profile.urgency,
  });
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }));
  const { pending, error, fieldError, run } = useSave(v);

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); run(() => saveCareer(v), () => onDone(v)); }}>
      {!embedded && <StepHeader title="What are you aiming for?" subtitle="Your agents use this to find roles, tune your profile and plan your week." />}
      <div className="space-y-7">
        <Field label="Target roles" hint="Up to 3. Press Enter after each." error={fieldError("target_roles")}>
          <ChipInput value={v.target_roles} onChange={(target_roles) => set({ target_roles })} placeholder="e.g. Senior Product Designer" suggestions={ROLE_SUGGESTIONS} max={3} />
        </Field>
        <Field label="Seniority" error={fieldError("seniority")}>
          <SeniorityPicker value={v.seniority} onChange={(seniority) => set({ seniority })} />
        </Field>
        <Field label="Industries" hint="Optional. Leave empty for any industry.">
          <ChipInput value={v.industries} onChange={(industries) => set({ industries })} placeholder="e.g. Fintech" suggestions={INDUSTRY_SUGGESTIONS} />
        </Field>
        <Field label="Search mode" error={fieldError("search_mode")}>
          <Choice
            options={[
              ["open", "Open", "I'm openly looking. Show the #OpenToWork signal."],
              ["stealth", "Stealth", "I'm employed. Keep my search discreet."],
            ]}
            value={v.search_mode}
            onChange={(search_mode) => set({ search_mode })}
          />
        </Field>
        <Field label="How actively are you looking?">
          <Choice
            options={[
              ["active", "Actively applying", "I want interviews soon"],
              ["exploring", "Exploring", "Open to the right opportunity"],
            ]}
            value={v.urgency}
            onChange={(urgency) => set({ urgency })}
          />
        </Field>
      </div>
      <StepFooter busy={pending} error={error} label={embedded ? "Save changes" : undefined} />
    </form>
  );
}

// Several levels can apply ("Senior" and "Lead / Staff"), so this is a multi-select.
function SeniorityPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return <MultiChoice<string> options={SENIORITY} value={value} onChange={onChange} />;
}

const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(/[^\d]/g, "")))));

export function PreferencesStep({ profile, onDone, onBack, embedded }: StepProps) {
  const [v, setV] = useState({
    locations: profile.locations,
    work_modes: profile.work_modes,
    open_to_relocate: profile.open_to_relocate,
    needs_sponsorship: profile.needs_sponsorship,
    salary_min: profile.salary_min,
    salary_target: profile.salary_target,
    salary_currency: profile.salary_currency,
    notice_period: profile.notice_period,
    daily_minutes: profile.daily_minutes,
  });
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }));
  const { pending, error, fieldError, run } = useSave(v);

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); run(() => savePreferences(v), () => onDone(v)); }}>
      {!embedded && <StepHeader title="Where, how and how much?" subtitle="We only surface jobs that match these, and never share your salary expectations." />}
      <div className="space-y-7">
        <Field label="Locations" hint="Cities, countries, or “Anywhere”." error={fieldError("locations")}>
          <ChipInput value={v.locations} onChange={(locations) => set({ locations })} placeholder="e.g. London" suggestions={["Anywhere", "Remote – US", "Remote – EU"]} />
        </Field>
        <Field label="Work mode" error={fieldError("work_modes")}>
          <MultiChoice options={WORK_MODES} value={v.work_modes} onChange={(work_modes) => set({ work_modes })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={v.open_to_relocate} onChange={(open_to_relocate) => set({ open_to_relocate })} label="Open to relocate" />
          <Toggle checked={v.needs_sponsorship} onChange={(needs_sponsorship) => set({ needs_sponsorship })} label="Need visa sponsorship" hint="We'll prioritize employers that sponsor" />
        </div>
        <Field label="Annual salary" hint="Optional. Used to filter jobs and plan negotiations." error={fieldError("salary_target", "salary_min")}>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input inputMode="numeric" className={inputClass} placeholder="Minimum" value={v.salary_min ?? ""} onChange={(ev) => set({ salary_min: num(ev.target.value) })} />
            <input inputMode="numeric" className={inputClass} placeholder="Target" value={v.salary_target ?? ""} onChange={(ev) => set({ salary_target: num(ev.target.value) })} />
            <select className={inputClass} value={v.salary_currency} onChange={(ev) => set({ salary_currency: ev.target.value as typeof v.salary_currency })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </Field>
        <Field label="Notice period / earliest start" hint="Optional">
          <input className={inputClass} placeholder="e.g. 30 days, immediately" value={v.notice_period ?? ""} onChange={(ev) => set({ notice_period: ev.target.value || null })} />
        </Field>
        <Field label="Time you can spend each day" hint="Sizes your daily plan.">
          <Choice options={DAILY_MINUTES.map((m) => [m, m === 90 ? "90+ min" : `${m} min`] as const)} value={v.daily_minutes} onChange={(daily_minutes) => set({ daily_minutes })} columns={4} />
        </Field>
      </div>
      <StepFooter busy={pending} error={error} onBack={embedded ? undefined : onBack} label={embedded ? "Save changes" : undefined} />
    </form>
  );
}

export function LinkedinStep({ profile, onDone, onBack, embedded }: StepProps) {
  const [v, setV] = useState({
    linkedin_tier: profile.linkedin_tier,
    inmail_credits: profile.inmail_credits,
    dream_companies: profile.dream_companies,
    excluded_companies: profile.excluded_companies,
    voice_samples: profile.voice_samples,
  });
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }));
  const { pending, error, fieldError, run } = useSave(v);
  const premium = v.linkedin_tier !== "free";

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); run(() => saveLinkedin(v), () => onDone(v)); }}>
      {!embedded && <StepHeader title="Your LinkedIn setup" subtitle="Your plan changes what agents can do, like how many InMails to spend and on whom." />}
      <div className="space-y-7">
        <Field label="LinkedIn plan" error={fieldError("linkedin_tier")}>
          <Choice options={LINKEDIN_TIERS} value={v.linkedin_tier} onChange={(linkedin_tier) => set({ linkedin_tier })} />
        </Field>
        {premium && (
          <Field label="InMail credits left this month" hint="Optional. Agents save InMails for your highest-value targets.">
            <input inputMode="numeric" className={inputClass} placeholder="e.g. 5" value={v.inmail_credits ?? ""} onChange={(ev) => set({ inmail_credits: num(ev.target.value) })} />
          </Field>
        )}
        <Field label="Dream companies" hint="Optional. Referral Scout starts with these.">
          <ChipInput value={v.dream_companies} onChange={(dream_companies) => set({ dream_companies })} placeholder="e.g. Stripe" />
        </Field>
        <Field label="Companies to avoid" hint={profile.search_mode === "stealth" ? "Add your current employer so it's never contacted." : "Optional"}>
          <ChipInput value={v.excluded_companies} onChange={(excluded_companies) => set({ excluded_companies })} placeholder="e.g. Current employer" />
        </Field>
        <Field label="Writing samples" hint="Optional. Paste 2–3 of your posts or emails so drafts sound like you.">
          <textarea rows={5} className={inputClass} value={v.voice_samples ?? ""} onChange={(ev) => set({ voice_samples: ev.target.value || null })} placeholder="Paste a LinkedIn post or email you wrote…" />
        </Field>
      </div>
      <StepFooter busy={pending} error={error} onBack={embedded ? undefined : onBack} label={embedded ? "Save changes" : undefined} />
    </form>
  );
}

// Onboarding's single screen: the essentials (prefilled from the resume when possible), with
// everything optional tucked under "More preferences". All of it is editable later in Settings.
export function BasicsStep({ profile, onDone, onBack, prefill }: StepProps & { prefill?: { filled: string[]; aiNote?: string } | null }) {
  const [v, setV] = useState({
    target_roles: profile.target_roles,
    seniority: profile.seniority,
    industries: profile.industries,
    search_mode: profile.search_mode,
    urgency: profile.urgency,
    locations: profile.locations,
    work_modes: profile.work_modes,
    open_to_relocate: profile.open_to_relocate,
    needs_sponsorship: profile.needs_sponsorship,
    salary_min: profile.salary_min,
    salary_target: profile.salary_target,
    salary_currency: profile.salary_currency,
    notice_period: profile.notice_period,
    daily_minutes: profile.daily_minutes,
  });
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }));
  const { pending, error, fieldError, run } = useSave(v);
  const [more, setMore] = useState(false);
  const moreError = fieldError("salary_target", "salary_min");

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); run(() => saveBasics(v), () => onDone(v)); }}>
      <StepHeader title="Check the basics" subtitle="Your agents use these to find roles and plan your week. Change anything later in Settings." />
      {prefill && prefill.filled.length > 0 && (
        <p className="mb-6 flex items-start gap-2 rounded-2xl bg-wing/5 px-4 py-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-wing" />
          <span>Filled in from your resume: {prefill.filled.join(", ")}. Check it looks right.</span>
        </p>
      )}
      {prefill?.aiNote && <p className="mb-6 rounded-2xl bg-card px-4 py-3 text-xs text-muted">{prefill.aiNote}</p>}
      <div className="space-y-7">
        <Field label="Target roles" hint="Up to 3. Press Enter after each." error={fieldError("target_roles")}>
          <ChipInput value={v.target_roles} onChange={(target_roles) => set({ target_roles })} placeholder="e.g. Senior Product Designer" suggestions={ROLE_SUGGESTIONS} max={3} />
        </Field>
        <Field label="Seniority" hint="Pick every level you'd consider." error={fieldError("seniority")}>
          <SeniorityPicker value={v.seniority} onChange={(seniority) => set({ seniority })} />
        </Field>
        <Field label="Locations" hint="Cities, countries, or “Anywhere”." error={fieldError("locations")}>
          <ChipInput value={v.locations} onChange={(locations) => set({ locations })} placeholder="e.g. London" suggestions={["Anywhere", "Remote – US", "Remote – EU"]} />
        </Field>
        <Field label="Work mode" error={fieldError("work_modes")}>
          <MultiChoice options={WORK_MODES} value={v.work_modes} onChange={(work_modes) => set({ work_modes })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle checked={v.search_mode === "stealth"} onChange={(on) => set({ search_mode: on ? "stealth" : "open" })} label="Keep my search discreet" hint="I'm employed. No #OpenToWork signals." />
          <Toggle checked={v.needs_sponsorship} onChange={(needs_sponsorship) => set({ needs_sponsorship })} label="Need visa sponsorship" />
        </div>

        <div className="rounded-2xl border border-line">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more || !!moreError} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
            <span>More preferences <span className="font-normal text-muted">· optional: industries, salary, notice, pace</span></span>
            <ChevronDown className={`size-4 transition-transform ${more || moreError ? "rotate-180" : ""}`} />
          </button>
          {(more || moreError) && (
            <div className="space-y-7 border-t border-line p-4">
              <Field label="Industries" hint="Leave empty for any industry.">
                <ChipInput value={v.industries} onChange={(industries) => set({ industries })} placeholder="e.g. Fintech" suggestions={INDUSTRY_SUGGESTIONS} />
              </Field>
              <Toggle checked={v.open_to_relocate} onChange={(open_to_relocate) => set({ open_to_relocate })} label="Open to relocate" />
              <Field label="Annual salary" hint="Used to filter jobs and plan negotiations. Never shared." error={moreError}>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input inputMode="numeric" className={inputClass} placeholder="Minimum" aria-label="Minimum salary" value={v.salary_min ?? ""} onChange={(ev) => set({ salary_min: num(ev.target.value) })} />
                  <input inputMode="numeric" className={inputClass} placeholder="Target" aria-label="Target salary" value={v.salary_target ?? ""} onChange={(ev) => set({ salary_target: num(ev.target.value) })} />
                  <select className={inputClass} aria-label="Currency" value={v.salary_currency} onChange={(ev) => set({ salary_currency: ev.target.value as typeof v.salary_currency })}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Notice period / earliest start">
                <input className={inputClass} placeholder="e.g. 30 days, immediately" aria-label="Notice period" value={v.notice_period ?? ""} onChange={(ev) => set({ notice_period: ev.target.value || null })} />
              </Field>
              <Field label="How actively are you looking?">
                <Choice
                  options={[
                    ["active", "Actively applying", "I want interviews soon"],
                    ["exploring", "Exploring", "Open to the right opportunity"],
                  ]}
                  value={v.urgency}
                  onChange={(urgency) => set({ urgency })}
                />
              </Field>
              <Field label="Time you can spend each day" hint="Sizes your daily plan.">
                <Choice options={DAILY_MINUTES.map((m) => [m, m === 90 ? "90+ min" : `${m} min`] as const)} value={v.daily_minutes} onChange={(daily_minutes) => set({ daily_minutes })} columns={4} />
              </Field>
            </div>
          )}
        </div>
      </div>
      <StepFooter busy={pending} error={error} onBack={onBack} />
    </form>
  );
}
