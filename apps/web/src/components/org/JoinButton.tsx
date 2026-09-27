"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { joinOrganization } from "@/app/org/actions";

export function JoinButton({ code, label }: { code: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const r = await joinOrganization(code);
            if (r?.error) setError(r.error);
          })
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {label}
      </button>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
