import { Check } from "lucide-react";
import { Eyebrow, Reveal } from "./Reveal";

const points = [
  "Fit score, gaps and red flags on every job post",
  "Who you know at the company, and the best person to ask",
  "Pre-filled screening answers beside Easy Apply",
  "Message and comment drafts you paste and send yourself",
];

export function Extension() {
  return (
    <section id="extension" className="relative overflow-hidden bg-ink py-24 text-white">
      <div className="pixel-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 md:grid-cols-2">
        <Reveal>
          <Eyebrow dark>Browser extension</Eyebrow>
          <h2 className="headline mt-4 text-4xl font-semibold sm:text-6xl">Your copilot, right beside LinkedIn.</h2>
          <p className="mt-5 max-w-md text-white/65">
            Open any job, profile or company page and Offerwing tells you what matters, only when you click.
          </p>
          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-white/85">
                <Check className="mt-0.5 size-5 shrink-0 text-offer" /> {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3 shadow-2xl">
            <div className="flex items-center gap-1.5 px-2 pb-3">
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="ml-3 h-5 flex-1 rounded-md bg-white/10" />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-3 rounded-2xl bg-white/[0.06] p-4">
                <div className="h-3 w-2/3 rounded bg-white/25" />
                <div className="h-2 w-1/2 rounded bg-white/15" />
                <div className="mt-4 space-y-2">
                  {[10, 11, 9, 12, 8, 10].map((w, i) => (
                    <div key={i} className="h-2 rounded bg-white/10" style={{ width: `${w * 8}%` }} />
                  ))}
                </div>
              </div>
              <div className="col-span-2 rounded-2xl bg-white p-4 text-ink">
                <p className="text-xs font-semibold text-wing">Offerwing</p>
                <p className="mt-2 text-3xl font-semibold">91<span className="text-base text-muted">% fit</span></p>
                <p className="mt-2 text-xs text-muted">Missing: &ldquo;experimentation&rdquo;</p>
                <div className="mt-3 rounded-xl bg-card p-2.5 text-xs">
                  <p className="font-medium">Ask Priya S.</p>
                  <p className="text-muted">Ex-colleague · refers often</p>
                </div>
                <button className="mt-3 w-full rounded-lg bg-wing py-2 text-xs font-medium text-white">Copy referral ask</button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
