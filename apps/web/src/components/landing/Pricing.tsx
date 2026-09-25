import { ArrowRight, Check } from "lucide-react";
import { Eyebrow, Reveal } from "./Reveal";

const modes = [
  {
    name: "Starter",
    tag: "No key needed",
    body: "Try Offerwing on us.",
    features: ["Full profile audit", "First ranked job shortlist", "A few drafts every day"],
  },
  {
    name: "Private",
    tag: "Your key stays in your browser",
    body: "Maximum privacy.",
    features: ["Every agent and draft", "Key never leaves your device", "Works while your browser is open"],
    highlight: true,
  },
  {
    name: "Always-on",
    tag: "Encrypted key in the cloud",
    body: "Agents that never sleep.",
    features: ["Everything in Private", "Overnight job scoring", "Morning brief and reminders"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="headline mt-4 text-4xl font-semibold sm:text-6xl">
            Free. <span className="text-muted">Really.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Bring your own OpenAI, Anthropic or Gemini key and pay your provider directly, usually a few dollars a month.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {modes.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.08}>
              <div className={`flex h-full flex-col rounded-[2rem] p-8 ${m.highlight ? "bg-ink text-white wing-glow" : "bg-card"}`}>
                <p className={`text-sm ${m.highlight ? "text-wing-soft" : "text-wing"}`}>{m.tag}</p>
                <h3 className="mt-2 text-2xl font-semibold">{m.name}</h3>
                <p className={`mt-1 text-sm ${m.highlight ? "text-white/60" : "text-muted"}`}>{m.body}</p>
                <p className="mt-6 text-5xl font-semibold tracking-tight">$0</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {m.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-wing" /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors ${
                    m.highlight ? "bg-wing text-white hover:bg-wing-soft" : "bg-white hover:bg-white/70"
                  }`}
                >
                  Start with {m.name} <ArrowRight className="size-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
