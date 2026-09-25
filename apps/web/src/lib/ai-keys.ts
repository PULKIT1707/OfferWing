import "server-only";
import type { Provider } from "./onboarding";

// Validates a key with each provider's free model-listing endpoint (no tokens are spent).
export async function verifyProviderKey(provider: Provider, key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const requests: Record<Provider, () => Promise<Response>> = {
    openai: () => fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }),
    anthropic: () =>
      fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }),
    gemini: () => fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": key } }),
  };

  try {
    const res = await requests[provider]();
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      return { ok: false, error: "The provider rejected this key. Check that you copied it fully and that it's active." };
    }
    return { ok: false, error: `The provider returned an error (${res.status}). Try again in a moment.` };
  } catch {
    return { ok: false, error: "Couldn't reach the provider to check the key. Try again in a moment." };
  }
}
