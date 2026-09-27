"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createOrganization } from "@/app/org/actions";
import { Choice, inputClass } from "@/components/onboarding/fields";

export function CreateOrgForm() {
  const [kind, setKind] = useState<"outplacement" | "recruiting">("outplacement");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const r = await createOrganization(kind, name, website);
          if (r?.error) setError(r.error);
        });
      }}
    >
      <Choice
        columns={2}
        value={kind}
        onChange={setKind}
        options={[
          ["outplacement", "Outplacement", "Support people leaving your company"],
          ["recruiting", "Recruiting", "Find candidates who opted in"],
        ]}
      />
      <input className={inputClass} placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className={inputClass} placeholder="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <p className="text-xs text-muted">
        {kind === "outplacement"
          ? "Starts with 10 seats. Invite people, sponsor their AI with your own key, and see progress they choose to share."
          : "Offerwing verifies recruiting teams before they can search candidates. Candidates hide from their current employer automatically."}
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
        {pending && <Loader2 className="size-4 animate-spin" />} Create organization
      </button>
    </form>
  );
}
