import type { Provider } from "@/lib/onboarding";

// premium: deep writing and strategy · standard: drafts · fast: extraction and scoring.
export type Tier = "premium" | "standard" | "fast";

// OpenAI and Gemini model names change often; override per deployment with env vars
// (e.g. OFFERWING_OPENAI_MODEL_PREMIUM) instead of editing code.
const DEFAULTS: Record<Provider, Record<Tier, string>> = {
  anthropic: { premium: "claude-opus-5", standard: "claude-sonnet-5", fast: "claude-haiku-4-5" },
  openai: { premium: "gpt-5", standard: "gpt-5", fast: "gpt-5-mini" },
  gemini: { premium: "gemini-2.5-pro", standard: "gemini-2.5-pro", fast: "gemini-2.5-flash" },
};

export function modelFor(provider: Provider, tier: Tier): string {
  return process.env[`OFFERWING_${provider.toUpperCase()}_MODEL_${tier.toUpperCase()}`] || DEFAULTS[provider][tier];
}
