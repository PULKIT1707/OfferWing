"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { leaveOrganization, setShareProgress } from "@/app/org/actions";
import { Toggle } from "@/components/onboarding/fields";

export type SponsorMembership = { orgId: string; name: string; shareProgress: boolean; sponsoredAi: boolean };

// Outplacement programs the user belongs to: what the sponsor can see, and how to leave.
export function SponsorSettings({ memberships }: { memberships: SponsorMembership[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [leaving, setLeaving] = useState<string | null>(null);
  // Optimistic sharing state, so the switch moves as soon as it's tapped.
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const run = (fn: () => Promise<{ error?: string }>, onError?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (r.error) {
        setError(r.error);
        onError?.();
      }
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {memberships.map((m) => (
        <div key={m.orgId} className="space-y-3 rounded-2xl border border-line p-5">
          <p className="font-medium">{m.name}</p>
          <p className="text-sm text-muted">
            {m.sponsoredAi ? "Pays for your AI agents: no daily Starter limits. " : "Your AI isn't sponsored right now. "}
            They see program totals only, never your documents, drafts, messages or which companies you apply to.
          </p>
          <Toggle
            checked={shared[m.orgId] ?? m.shareProgress}
            onChange={(v) => {
              setShared((s) => ({ ...s, [m.orgId]: v }));
              run(() => setShareProgress(m.orgId, v), () => setShared((s) => ({ ...s, [m.orgId]: !v })));
            }}
            label="Share my progress with the program"
            hint="Your name, email, last active date and counts of saved jobs, applications, interviews and offers. Helps your coach support you."
          />
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm(`Leave ${m.name}? You keep your account and data, but lose sponsored AI.`)) return;
              setLeaving(m.orgId);
              run(() => leaveOrganization(m.orgId));
            }}
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
          >
            {pending && leaving === m.orgId && <Loader2 className="size-4 animate-spin" />} Leave program
          </button>
        </div>
      ))}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
