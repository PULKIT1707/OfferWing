import { ArrowRight, Radar, Users } from "lucide-react";
import { Eyebrow, Reveal } from "./Reveal";

const offers = [
  {
    icon: Users,
    tag: "For employers",
    name: "Outplacement that people actually use",
    body: "When roles are cut, give every leaver an AI wingman for their whole search, not a PDF and a webinar.",
    points: ["Invite links, seats and your own branding", "Sponsor their AI with your key: no limits", "Program totals and placement rate; individual progress only if each person opts in"],
    cta: "Start a program",
  },
  {
    icon: Radar,
    tag: "For recruiters",
    name: "Candidates who asked to be found",
    body: "Search anonymous profiles where every highlight was checked against the candidate's own resume.",
    points: ["Verified teams only, so candidates trust the intro", "They see your role and message, then decide", "Accepted intros land in their pipeline, ready to apply"],
    cta: "Set up your team",
  },
];

export function ForTeams() {
  return (
    <section id="teams" className="bg-card py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Eyebrow>For teams</Eyebrow>
          <h2 className="headline mt-4 text-4xl font-semibold sm:text-6xl">
            Free for job seekers. <span className="text-muted">Funded by teams.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {offers.map((o, i) => (
            <Reveal key={o.name} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-[2rem] bg-white p-8">
                <o.icon className="size-6 text-wing" />
                <p className="mt-5 text-sm text-wing">{o.tag}</p>
                <h3 className="mt-1 text-2xl font-semibold">{o.name}</h3>
                <p className="mt-2 text-sm text-muted">{o.body}</p>
                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {o.points.map((p) => <li key={p}>• {p}</li>)}
                </ul>
                <a href="/signup?next=/org" className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white hover:opacity-90">
                  {o.cta} <ArrowRight className="size-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
