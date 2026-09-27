import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinButton } from "@/components/org/JoinButton";
import { Logo } from "@/components/landing/Logo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join · Offerwing", robots: { index: false, follow: false } };

type Preview = { org_name: string; kind: "outplacement" | "recruiting"; brand_color: string | null; role: "admin" | "member"; sponsored: boolean; valid: boolean };

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  const supabase = await createClient();
  const [{ data }, { data: claims }] = await Promise.all([
    /^[0-9a-f]{32}$/.test(code) ? supabase.rpc("get_invite_preview", { p_code: code }) : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const p = data as Preview | null;
  const signedIn = !!claims?.claims?.sub;
  const next = encodeURIComponent(`/join/${code}`);
  const seeker = p?.kind === "outplacement" && p.role === "member";

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-ink px-4 py-12 text-white">
      <Link href="/" className="mb-8"><Logo className="text-xl" /></Link>
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-foreground">
        {!p || !p.valid ? (
          <>
            <h1 className="text-2xl font-semibold">This invite isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-muted">It may have expired, been turned off or used up. Ask whoever sent it for a new link.</p>
          </>
        ) : (
          <>
            <span className="inline-block size-3 rounded-full" style={{ background: p.brand_color ?? "var(--wing)" }} />
            <h1 className="mt-3 text-2xl font-semibold">
              {seeker ? `${p.org_name} is supporting your next move` : `Join ${p.org_name} on Offerwing`}
            </h1>
            {seeker ? (
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  "AI agents for your whole search: profile, job matches, tailored applications, referrals and interview prep",
                  p.sponsored ? `${p.org_name} covers the AI costs, with no daily limits` : "Free to use",
                  `${p.org_name} sees program totals only. Sharing your own progress is off unless you turn it on`,
                  "Your account and data stay yours, even after the program ends",
                ].map((t) => (
                  <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-wing" /> {t}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                You&apos;re invited as {p.role === "admin" ? "an admin" : p.kind === "recruiting" ? "a recruiter" : "a member"} of this {p.kind === "outplacement" ? "outplacement program" : "recruiting team"}.
              </p>
            )}
            <div className="mt-6">
              {signedIn ? (
                <JoinButton code={code} label={seeker ? "Accept and get started" : "Join"} />
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href={`/signup?next=${next}`} className="rounded-xl bg-wing px-4 py-3 text-center text-sm font-medium text-white hover:bg-wing-soft">Create a free account</Link>
                  <Link href={`/login?next=${next}`} className="rounded-xl border border-line px-4 py-3 text-center text-sm font-medium hover:border-wing hover:text-wing">I already have an account</Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
