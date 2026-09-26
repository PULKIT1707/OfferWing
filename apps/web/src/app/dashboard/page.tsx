import { ArrowRight, Briefcase, CalendarClock, Check, Circle, Handshake, Inbox, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STAGES, CONTACT_COLUMNS, JOB_COLUMNS, sameCompany, type Contact, type Job } from "@/lib/dashboard";
import { userDate, userTimeZone } from "@/lib/user-time";
import { weekStartInZone } from "@/lib/time";
import type { WeeklyPlan } from "@/lib/agents/coach";
import { WeeklyPlanCard } from "@/components/dashboard/WeeklyPlanCard";

export const metadata: Metadata = { title: "Today · Offerwing" };

// "Plan my week" calls the AI model from a server action on this route.
export const maxDuration = 60;

function Stat({ icon: Icon, label, value, href }: { icon: typeof Briefcase; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-3xl bg-white p-5 transition hover:ring-2 hover:ring-wing/30">
      <Icon className="size-5 text-wing" />
      <p className="mt-6 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </Link>
  );
}

const fmt = (d: string) => new Date(d + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default async function TodayPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: profile }, { data: ai }, { data: docs }, { data: jobsData }, { data: contactsData }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase.from("ai_settings").select("mode").eq("user_id", userId).maybeSingle(),
    supabase.from("career_documents").select("kind"),
    supabase.from("jobs").select(JOB_COLUMNS),
    supabase.from("contacts").select(CONTACT_COLUMNS),
  ]);
  const allJobs = (jobsData ?? []) as Job[];
  // Inbox (discovered) and dismissed jobs aren't part of the pipeline yet.
  const inboxCount = allJobs.filter((j) => j.stage === "discovered").length;
  const jobs = allJobs.filter((j) => j.stage !== "discovered" && j.stage !== "dismissed");
  const contacts = (contactsData ?? []) as Contact[];
  const now = await userDate(supabase, userId);
  const { data: weeklyPlan } = await supabase
    .from("weekly_plans")
    .select("plan")
    .eq("user_id", userId)
    .eq("week_start", weekStartInZone(await userTimeZone(supabase, userId)))
    .maybeSingle();

  const hasDoc = (kind: string) => docs?.some((d) => d.kind === kind) ?? false;
  const setup = [
    { done: hasDoc("resume"), label: "Upload your resume", href: "/dashboard/settings#documents" },
    { done: hasDoc("linkedin_export"), label: "Add your LinkedIn data export", href: "/dashboard/settings#documents" },
    { done: ai?.mode !== "starter", label: "Connect your own AI key", href: "/dashboard/settings#ai" },
    { done: jobs.length > 0, label: "Add your first job", href: "/dashboard/jobs" },
    { done: contacts.length > 0, label: "Add someone who could refer you", href: "/dashboard/network" },
  ];
  const setupLeft = setup.filter((s) => !s.done).length;

  const open = jobs.filter((j) => !["rejected", "withdrawn"].includes(j.stage));
  const due = [
    ...open
      .filter((j) => j.next_action && j.next_action_at && j.next_action_at <= now)
      .map((j) => ({ key: `j-${j.id}`, text: j.next_action!, meta: `${j.title} · ${j.company}`, date: j.next_action_at!, href: "/dashboard/jobs" })),
    ...contacts
      .filter((c) => c.next_follow_up_at && c.next_follow_up_at <= now)
      .map((c) => ({ key: `c-${c.id}`, text: `Follow up with ${c.full_name}`, meta: c.company ?? "", date: c.next_follow_up_at!, href: "/dashboard/network" })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Referral opportunities: open, pre-interview jobs where you know someone who hasn't been asked yet.
  const referralIdeas = open
    .filter((j) => j.stage === "saved" || j.stage === "applied")
    .map((j) => ({ job: j, person: contacts.filter((c) => sameCompany(c.company, j.company) && ["none", "to_ask"].includes(c.referral_status)).sort((a, b) => b.strength - a.strength)[0] }))
    .filter((x) => x.person)
    .slice(0, 4);
  const noOneThere = open.filter((j) => j.stage === "saved" && !contacts.some((c) => sameCompany(c.company, j.company))).slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1 className="headline mt-1 text-3xl font-semibold sm:text-4xl">
        {greeting}
        {firstName ? `, ${firstName}` : ""}.
      </h1>

      {inboxCount > 0 && (
        <Link href="/dashboard/jobs" className="mt-6 flex items-center gap-3 rounded-3xl bg-wing px-5 py-4 text-white hover:bg-wing-soft">
          <Inbox className="size-5" />
          <span className="flex-1 font-medium">
            {inboxCount} new {inboxCount === 1 ? "job" : "jobs"} in your inbox
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Briefcase} label="Active applications" value={jobs.filter((j) => ACTIVE_STAGES.includes(j.stage)).length} href="/dashboard/jobs" />
        <Stat icon={CalendarClock} label="Interviewing" value={jobs.filter((j) => j.stage === "interview").length} href="/dashboard/jobs" />
        <Stat icon={Trophy} label="Offers" value={jobs.filter((j) => j.stage === "offer").length} href="/dashboard/jobs" />
        <Stat icon={Handshake} label="Referrals in progress" value={contacts.filter((c) => ["asked", "agreed", "referred"].includes(c.referral_status)).length} href="/dashboard/network" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-semibold">Due today</h2>
            {due.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing due. Add a next step to a job or a follow-up date to a contact and it shows up here.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {due.map((d) => (
                  <li key={d.key}>
                    <Link href={d.href} className="flex items-center gap-3 py-3 hover:text-wing">
                      <Circle className="size-4 shrink-0 text-wing" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.text}</span>
                        <span className="block truncate text-xs text-muted">{d.meta}</span>
                      </span>
                      <span className={`text-xs ${d.date < now ? "font-medium text-red-600" : "text-muted"}`}>{d.date < now ? `Overdue · ${fmt(d.date)}` : "Today"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-semibold">Referral opportunities</h2>
            {referralIdeas.length === 0 && noOneThere.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Save jobs and add people you know. We&apos;ll match them up so you can ask for referrals before you apply.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {referralIdeas.map(({ job, person }) => (
                  <li key={job.id} className="flex items-center gap-3 rounded-2xl bg-card p-4">
                    <Users className="size-5 shrink-0 text-wing" />
                    <p className="flex-1 text-sm">
                      Ask <span className="font-medium">{person!.full_name}</span> for a referral to <span className="font-medium">{job.title}</span> at {job.company}
                    </p>
                    <Link href="/dashboard/network" className="text-wing" aria-label="Open network">
                      <ArrowRight className="size-4" />
                    </Link>
                  </li>
                ))}
                {noOneThere.map((job) => (
                  <li key={job.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4">
                    <Users className="size-5 shrink-0 text-muted" />
                    <p className="flex-1 text-sm text-muted">
                      You don&apos;t know anyone at <span className="font-medium text-foreground">{job.company}</span> yet. Look for alumni or ex-colleagues there.
                    </p>
                    <Link href="/dashboard/network" className="text-wing" aria-label="Open network">
                      <ArrowRight className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {setupLeft > 0 && (
            <section className="rounded-3xl bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Finish setting up</h2>
                <span className="text-sm text-muted">{setup.length - setupLeft}/{setup.length}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-card">
                <div className="h-full rounded-full bg-wing" style={{ width: `${((setup.length - setupLeft) / setup.length) * 100}%` }} />
              </div>
              <ul className="mt-4 space-y-1">
                {setup.map((s) => (
                  <li key={s.label}>
                    <Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-card">
                      <span className={`grid size-5 place-items-center rounded-full ${s.done ? "bg-wing text-white" : "border-2 border-line"}`}>{s.done && <Check className="size-3" />}</span>
                      <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <WeeklyPlanCard plan={(weeklyPlan?.plan as WeeklyPlan | undefined) ?? null} />
        </div>
      </div>
    </div>
  );
}
