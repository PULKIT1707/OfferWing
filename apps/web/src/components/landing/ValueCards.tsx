import { BadgeCheck, Briefcase, Handshake, MessagesSquare } from "lucide-react";
import { Reveal } from "./Reveal";

const cards = [
  { icon: BadgeCheck, title: "A profile that ranks", body: "Keyword-tuned headline, About and skills so recruiters find you first." },
  { icon: Briefcase, title: "Jobs that actually fit", body: "Every job scored for fit, freshness and red flags, every morning." },
  { icon: Handshake, title: "Referrals, not cold applies", body: "Find mutuals and alumni who can refer you, with the ask drafted." },
  { icon: MessagesSquare, title: "Interview-ready", body: "Company briefs, STAR stories and mock interviews for every stage." },
];

export function ValueCards() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-muted">Everything a job search needs, run by specialist AI agents</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="h-full rounded-[var(--radius-card)] bg-card p-6">
                <Icon className="size-6 text-wing" />
                <h3 className="mt-8 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
