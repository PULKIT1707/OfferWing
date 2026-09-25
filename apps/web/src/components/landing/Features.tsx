import { ArrowRight, Check, FileText, Send } from "lucide-react";
import { Eyebrow, Reveal } from "./Reveal";

const brief = [
  { done: true, title: "Apply: Stripe · Product Designer", meta: "Tailored resume ready · 91% fit" },
  { done: true, title: "Ask Priya for a referral", meta: "Draft approved · 9:40 AM" },
  { done: false, title: "Follow up with Figma recruiter", meta: "Day 4 nudge · due today" },
  { done: false, title: "Comment on 5 hiring-manager posts", meta: "Suggestions ready" },
];

export function Features() {
  return (
    <section id="features" className="bg-white pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <Eyebrow>Core features</Eyebrow>
          <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="headline max-w-2xl text-4xl font-semibold sm:text-6xl">
              Take full control of your job search.
            </h2>
            <a href="/signup" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-wing px-5 py-3 text-sm font-medium text-white hover:bg-wing-soft transition-colors md:self-auto">
              Get started free <ArrowRight className="size-4" />
            </a>
          </div>
          <p className="mt-4 max-w-xl text-muted">From the first profile fix to the signed offer, one command center with every step planned, drafted and tracked.</p>
        </Reveal>

        <Reveal className="mt-12">
          <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-white sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-wing/40 blur-[120px]" />
            <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                <h3 className="headline text-3xl font-medium sm:text-4xl">Your morning brief. Made simple.</h3>
                <p className="mt-4 max-w-md text-white/65">
                  Wake up to a plan: the best new jobs, referrals to ask for, follow-ups that are due and drafts waiting
                  for your approval. About 60 focused minutes a day.
                </p>
                <a href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-wing px-5 py-3 text-sm font-medium hover:bg-wing-soft transition-colors">
                  See your first brief <ArrowRight className="size-4" />
                </a>
              </div>
              <div className="rounded-3xl bg-white p-5 text-ink shadow-2xl">
                <p className="text-lg font-semibold">Today</p>
                <p className="text-sm text-muted">4 tasks · about 45 min</p>
                <div className="mt-4 flex gap-1.5 text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <span key={d} className={`flex-1 rounded-lg py-1.5 text-center ${i === 2 ? "bg-wing text-white" : "bg-card"}`}>{d}</span>
                  ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {brief.map((t) => (
                    <li key={t.title} className="flex items-start gap-3">
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${t.done ? "bg-wing text-white" : "border-2 border-wing/40"}`}>
                        {t.done && <Check className="size-3" />}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-xs text-muted">{t.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-[2rem] bg-card p-8">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-wing" />
                  <p className="text-sm font-medium">Resume · tailored for Stripe</p>
                  <span className="ml-auto rounded-full bg-offer px-2 py-0.5 text-xs font-semibold">ATS 94%</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-11/12 rounded bg-card" />
                  <div className="h-2 w-9/12 rounded bg-wing/25" />
                  <div className="h-2 w-10/12 rounded bg-card" />
                </div>
              </div>
              <h3 className="mt-8 text-xl font-medium">Tailored applications, never fabricated</h3>
              <p className="mt-2 text-sm text-muted">
                Resumes, cover letters and screening answers matched to each job. Every claim is checked against your real experience.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-[2rem] bg-card p-8">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Send className="size-5 text-wing" />
                  <p className="text-sm font-medium">Intro via Arjun → Maya (Hiring Manager)</p>
                </div>
                <p className="mt-3 text-xs text-muted">&ldquo;Hi Arjun, I noticed you worked with Maya at Figma. Would you be open to…&rdquo;</p>
              </div>
              <h3 className="mt-8 text-xl font-medium">Referral Scout finds your warm paths</h3>
              <p className="mt-2 text-sm text-muted">
                Mutual connections, alumni and ex-colleagues at every target company, ranked by who is most likely to refer you.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
