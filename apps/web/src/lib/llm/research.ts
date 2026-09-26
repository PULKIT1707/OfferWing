import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Credential } from "./credentials";
import { modelFor } from "./models";

export type Research = { text: string; sources: { title: string; url: string }[] };

const MAX_CONTINUATIONS = 4;

// Web research via Anthropic's server-side web search. Only available when the user's provider is
// Anthropic; callers fall back to the job posting alone otherwise. Returns null on any failure so a
// research problem never blocks the main task.
export async function researchWithWeb(credential: Credential, question: string): Promise<Research | null> {
  if (credential.provider !== "anthropic") return null;
  const client = new Anthropic({ apiKey: credential.apiKey });
  const model = modelFor("anthropic", "standard");
  const tools = [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 }];
  const system =
    "You research companies for job candidates preparing for interviews. Be factual and recent, prefer the company's own site and reputable news, and say when information is uncertain. Keep it under 400 words.";

  try {
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const res = await client.messages.create({ model, max_tokens: 8000, system, messages, tools });
      if (res.stop_reason === "pause_turn") {
        // The server-side search loop paused; resend the turn so it resumes where it stopped.
        messages = [{ role: "user", content: question }, { role: "assistant", content: res.content }];
        continue;
      }
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      const sources = res.content.flatMap((b) =>
        b.type === "web_search_tool_result" && Array.isArray(b.content) ? b.content.map((r) => ({ title: r.title, url: r.url })) : [],
      );
      const unique = sources.filter((s, idx) => sources.findIndex((o) => o.url === s.url) === idx).slice(0, 8);
      return text ? { text, sources: unique } : null;
    }
    return null;
  } catch (err) {
    console.error("web research failed", err);
    return null;
  }
}
