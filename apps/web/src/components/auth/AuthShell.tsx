import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/Logo";

const points = [
  "Profile audit and top fixes in about 10 minutes",
  "Jobs ranked by fit every morning",
  "People who can refer you at every target company",
  "You approve every message. Nothing is sent for you.",
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Link href="/" aria-label="Offerwing home">
          <Logo className="text-lg" />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="pixel-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-24 top-10 size-[420px] rounded-full bg-wing/40 blur-[140px]" />
        <div className="relative">
          <h2 className="headline max-w-md text-5xl font-semibold">
            Your AI wingman from profile to <span className="text-offer">offer</span>.
          </h2>
          <ul className="mt-10 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-white/80">
                <Check className="mt-0.5 size-5 shrink-0 text-offer" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
