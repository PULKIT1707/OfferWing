"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Eyebrow, Reveal } from "./Reveal";

const faqs = [
  ["Will using Offerwing get my LinkedIn account restricted?", "Offerwing never automates actions on LinkedIn. It never clicks Send, Connect, Apply or Post. Agents prepare everything and you take the final action yourself, within natural daily limits."],
  ["Do you need my LinkedIn password?", "No, never. You sign in with the official \"Sign in with LinkedIn\" button, and your data comes from the extension on pages you open, your LinkedIn data export and forwarded job-alert emails."],
  ["Why do I need my own AI key?", "It keeps Offerwing free. You pay your AI provider directly, usually a few dollars a month. Starter mode lets you try everything important before adding a key."],
  ["Where is my API key stored?", "You choose: only in your browser (Private) or encrypted on our servers for 24/7 agents (Always-on). You can switch or remove it at any time."],
  ["Does it write fake experience on my resume?", "No. Every tailored claim is checked against the experience you've confirmed. If something can't be backed up, it isn't written."],
  ["Which roles and countries does it support?", "Any role, any country. Offerwing learns what matters for your targets from real job descriptions."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-card py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-[1fr_1.4fr]">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="headline mt-4 text-4xl font-semibold sm:text-5xl">Questions, answered.</h2>
        </Reveal>
        <div className="space-y-3">
          {faqs.map(([q, a], i) => (
            <div key={q} className="rounded-2xl bg-white">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-medium"
                aria-expanded={open === i}
              >
                {q}
                <Plus className={`size-5 shrink-0 text-wing transition-transform ${open === i ? "rotate-45" : ""}`} />
              </button>
              {open === i && <p className="px-5 pb-5 text-sm text-muted">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
