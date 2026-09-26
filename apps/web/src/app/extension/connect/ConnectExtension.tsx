"use client";

import { CheckCircle2, Loader2, Puzzle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ChromeRuntime = { sendMessage: (id: string, msg: unknown, cb: (res?: { ok?: boolean }) => void) => void; lastError?: { message?: string } };

// Hands this browser's Offerwing session to the Offerwing extension, and only to the extension ID the
// server is configured with, so another extension can't request it.
export function ConnectExtension({ extensionId }: { extensionId: string | null }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string>();

  async function connect() {
    setState("busy");
    setError(undefined);
    const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
    if (!extensionId || !runtime?.sendMessage) {
      setState("error");
      setError(!extensionId ? "The extension isn't configured on this server yet." : "We can't find the Offerwing extension in this browser. Install it, then reload this page.");
      return;
    }
    const { data } = await createClient().auth.getSession();
    if (!data.session) {
      setState("error");
      setError("Your session expired. Log in again, then reconnect.");
      return;
    }
    runtime.sendMessage(extensionId, { type: "offerwing:connect", accessToken: data.session.access_token, refreshToken: data.session.refresh_token }, (res) => {
      if (runtime.lastError || !res?.ok) {
        setState("error");
        setError("The extension didn't respond. Make sure it's installed and enabled, then try again.");
      } else setState("done");
    });
  }

  if (state === "done") {
    return (
      <div className="mt-8">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h1 className="headline mt-4 text-2xl font-semibold">Extension connected</h1>
        <p className="mt-2 text-sm text-muted">Open any LinkedIn job, profile or company page and click the Offerwing icon. You can close this tab.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-wing/10">
        <Puzzle className="size-6 text-wing" />
      </div>
      <h1 className="headline mt-5 text-2xl font-semibold">Connect the Offerwing extension</h1>
      <p className="mt-2 text-sm text-muted">This signs the extension in to your Offerwing account on this browser.</p>
      <ul className="mt-5 space-y-2 text-left text-sm text-muted">
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-wing" /> It only reads a LinkedIn page when you click &ldquo;Analyze this page&rdquo;.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-wing" /> It never clicks, sends, applies or posts on LinkedIn.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-wing" /> Disconnect anytime from the extension&apos;s settings.</li>
      </ul>
      {error && <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button onClick={connect} disabled={state === "busy"} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
        {state === "busy" && <Loader2 className="size-4 animate-spin" />} Connect extension
      </button>
    </div>
  );
}
