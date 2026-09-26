import type { Provider } from "@/lib/onboarding";

// Private mode: the user's AI key is kept only in this browser's extension storage,
// which web pages (including LinkedIn) can't read. It is never sent to Offerwing.
const STORAGE_KEY = "offerwing:privateKey";

export type PrivateKey = { provider: Provider; apiKey: string };

export async function getPrivateKey(): Promise<PrivateKey | null> {
  return ((await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as PrivateKey | undefined) ?? null;
}
export const setPrivateKey = (k: PrivateKey) => chrome.storage.local.set({ [STORAGE_KEY]: k });
export const removePrivateKey = () => chrome.storage.local.remove(STORAGE_KEY);
