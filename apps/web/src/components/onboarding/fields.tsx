"use client";

import { Loader2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClass = "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-wing";

export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 20,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: readonly string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || value.length >= max || value.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 focus-within:border-wing">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-wing/10 px-3 py-1 text-sm text-wing">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            add(draft);
            setDraft("");
          }}
          placeholder={value.length >= max ? "" : placeholder}
          disabled={value.length >= max}
          className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm outline-none"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-wing hover:text-wing">
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: readonly (readonly [T, string, string?])[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div className={`grid gap-2 ${cols}`}>
      {options.map(([v, label, desc]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
            value === v ? "border-wing bg-wing/5 ring-1 ring-wing" : "border-line bg-white hover:border-wing/50"
          }`}
        >
          <span className="font-medium">{label}</span>
          {desc && <span className="mt-0.5 block text-xs text-muted">{desc}</span>}
        </button>
      ))}
    </div>
  );
}

export function MultiChoice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => {
        const on = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${on ? "border-wing bg-wing text-white" : "border-line bg-white hover:border-wing/50"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-wing peer-focus-visible:ring-2 peer-focus-visible:ring-wing/40 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function StepFooter({ busy, onBack, label = "Continue", error }: { busy: boolean; onBack?: () => void; label?: string; error?: string }) {
  return (
    <div className="mt-10 border-t border-line pt-6">
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button type="button" onClick={onBack} className="rounded-xl px-4 py-3 text-sm font-medium text-muted hover:text-foreground">
            Back
          </button>
        ) : (
          <span />
        )}
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-wing px-6 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {label}
        </button>
      </div>
    </div>
  );
}

export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="headline text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
    </div>
  );
}
