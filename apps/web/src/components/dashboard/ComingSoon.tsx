import { Check, type LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title, subtitle, features }: { icon: LucideIcon; title: string; subtitle: string; features: string[] }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="headline text-3xl font-semibold sm:text-4xl">{title}</h1>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted">Coming soon</span>
      </div>
      <p className="mt-2 text-muted">{subtitle}</p>
      <div className="relative mt-8 overflow-hidden rounded-3xl bg-ink p-8 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-wing/40 blur-[100px]" />
        <Icon className="relative size-7 text-wing-soft" />
        <p className="relative mt-6 font-semibold">What this agent will do</p>
        <ul className="relative mt-4 space-y-3">
          {features.map((f) => (
            <li key={f} className="flex gap-3 text-sm text-white/80">
              <Check className="mt-0.5 size-4 shrink-0 text-offer" /> {f}
            </li>
          ))}
        </ul>
        <p className="relative mt-6 text-xs text-white/50">Nothing is ever sent or posted for you. Every draft waits for your approval.</p>
      </div>
    </div>
  );
}
