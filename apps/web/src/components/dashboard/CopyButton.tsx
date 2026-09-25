"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

// navigator.clipboard needs a focused, secure page; fall back to a hidden textarea otherwise.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await copyText(text))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-wing hover:text-wing"
    >
      {copied ? <Check className="size-3.5 text-wing" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
