import { Eyebrow, Reveal } from "./Reveal";

const agents = [
  ["Career Coach", "Plans your week and keeps you on track"],
  ["Knowledge Base", "Your experience, stories and metrics in one place"],
  ["Profile Optimizer", "Headline, About, skills and Open to Work"],
  ["Job Discovery", "Alerts, company boards and links you paste"],
  ["Match & Prioritizer", "Fit score, gaps and ghost-job detection"],
  ["Application Tailor", "Resume, cover letter and screening answers"],
  ["Company Research", "One-page briefs and hiring-team maps"],
  ["Referral Scout", "Mutuals, alumni and ex-colleagues who can refer you"],
  ["Networking & Outreach", "Invites, messages and follow-ups"],
  ["Content & Brand", "Posts and comment ideas in your voice"],
  ["Tracker", "Pipeline, contacts and reminders"],
  ["Interview Prep", "Question banks and mock interviews"],
  ["Offer & Negotiation", "Benchmarks, comparisons and scripts"],
  ["Guardrail", "Safe limits, no fabrication, privacy first"],
  ["Analytics", "What's working, and what to change"],
];

export function Agents() {
  return (
    <section id="agents" className="bg-card py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Eyebrow>The team</Eyebrow>
          <h2 className="headline mx-auto mt-4 max-w-3xl text-4xl font-semibold sm:text-6xl">
            15 specialist agents. <span className="text-muted">One job search.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(([name, body], i) => (
            <Reveal key={name} delay={(i % 3) * 0.06}>
              <div className="flex h-full items-start gap-4 rounded-2xl bg-white p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-wing/10 text-sm font-semibold text-wing">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
