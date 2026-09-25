import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Eyebrow, Reveal } from "./Reveal";

const items = [
  { icon: ShieldCheck, title: "You approve everything", body: "Agents prepare. You send. Built-in limits keep your activity natural and within platform rules." },
  { icon: KeyRound, title: "Your AI key, your choice", body: "Keep your key only in your browser, or store it encrypted for 24/7 agents. Switch or remove it anytime." },
  { icon: Trash2, title: "Your data stays yours", body: "No passwords stored, no training on your data. Export or delete everything in one click." },
];

export function Trust() {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <Eyebrow>Security & privacy</Eyebrow>
          <h2 className="headline mt-4 max-w-2xl text-4xl font-semibold sm:text-6xl">Safe by design.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="h-full rounded-[var(--radius-card)] border border-line p-7">
                <Icon className="size-7 text-wing" />
                <h3 className="mt-10 text-xl font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
