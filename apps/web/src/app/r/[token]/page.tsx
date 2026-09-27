import { ArrowUpRight, Check, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { Logo } from "@/components/landing/Logo";
import { createClient } from "@/lib/supabase/server";

type Packet = {
  candidate_name: string | null;
  candidate_headline: string | null;
  linkedin_url: string | null;
  referrer_name: string | null;
  headline: string | null;
  fit_points: string[];
  blurb: string | null;
  note_to_referrer: string | null;
  has_resume: boolean;
  job_title: string;
  job_company: string;
  job_url: string | null;
  expires_at: string;
};

const loadPacket = cache(async (token: string): Promise<Packet | null> => {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_referral_packet", { p_token: token });
  return (data as Packet | null) ?? null;
});

export async function generateMetadata(props: PageProps<"/r/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const p = await loadPacket(token);
  return {
    title: p ? `${p.candidate_name ?? "Candidate"} for ${p.job_title} · Offerwing` : "Referral packet · Offerwing",
    robots: { index: false, follow: false },
  };
}

// Link-preview bots (Slack, LinkedIn, WhatsApp…) shouldn't count as views.
const BOT = /bot|crawl|spider|slack|preview|facebookexternalhit|whatsapp|linkedin|discord|telegram|embedly|skype/i;

export default async function ReferralPacketPage(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  const p = await loadPacket(token);
  if (!p) notFound();

  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT.test(ua)) {
    // cookies() can't be read inside after() while rendering, so create the client first.
    const supabase = await createClient();
    after(async () => {
      await supabase.rpc("record_referral_packet_view", { p_token: token });
    });
  }

  const first = p.candidate_name?.split(" ")[0] ?? "They";
  return (
    <div className="min-h-screen bg-card">
      <header className="bg-ink px-4 py-10 text-white sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-white/60">{p.referrer_name ? `For ${p.referrer_name} · ` : ""}Referral request</p>
          <h1 className="headline mt-2 text-4xl font-semibold sm:text-5xl">{p.candidate_name ?? "Candidate"}</h1>
          {p.headline && <p className="mt-2 text-lg text-white/80">{p.headline}</p>}
          <p className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm">
            Interested in <span className="font-semibold">{p.job_title}</span> at <span className="font-semibold">{p.job_company}</span>
            {p.job_url && (
              <a href={p.job_url} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-wing-soft hover:underline">
                View posting <ExternalLink className="size-3.5" />
              </a>
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
        {p.note_to_referrer && (
          <section className="rounded-3xl bg-white p-6">
            <p className="whitespace-pre-line leading-relaxed">{p.note_to_referrer}</p>
            <p className="mt-3 text-sm text-muted">{p.candidate_name}</p>
          </section>
        )}

        {p.fit_points.length > 0 && (
          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-semibold">Why {first} fits this role</h2>
            <ul className="mt-4 space-y-3">
              {p.fit_points.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-wing/10 text-wing"><Check className="size-3.5" /></span>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.blurb && (
          <section className="rounded-3xl bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Blurb for your referral form</h2>
                <p className="mt-1 text-sm text-muted">Paste this into your company&apos;s referral tool, edited however you like.</p>
              </div>
              <CopyButton text={p.blurb} />
            </div>
            <p className="mt-4 whitespace-pre-line rounded-2xl bg-card p-4 text-sm leading-relaxed">{p.blurb}</p>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-3xl bg-white p-6 sm:flex-row">
          {p.has_resume && (
            <a href={`/r/${token}/resume`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft">
              <Download className="size-4" /> Download resume (.docx)
            </a>
          )}
          {p.linkedin_url && (
            <a href={p.linkedin_url} target="_blank" rel="noreferrer nofollow" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium hover:border-wing hover:text-wing">
              <ExternalLink className="size-4" /> LinkedIn profile
            </a>
          )}
        </section>

        <p className="text-center text-xs text-muted">
          Offerwing checks every reason it writes against {first}&apos;s own resume. This link is private and expires{" "}
          {new Date(p.expires_at).toLocaleDateString("en", { month: "long", day: "numeric" })}.
        </p>

        <Link href="/signup?via=packet" className="group flex flex-col items-start gap-3 rounded-3xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo className="text-lg" />
            <p className="mt-2 text-sm text-white/70">{first} made this page with Offerwing, a free AI wingman for job searches. Looking yourself, or know someone who is?</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-offer px-4 py-2.5 text-sm font-semibold text-ink group-hover:opacity-90">
            Try it free <ArrowUpRight className="size-4" />
          </span>
        </Link>
      </main>
    </div>
  );
}
