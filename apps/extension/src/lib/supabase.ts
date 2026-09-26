import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// Session lives in chrome.storage.local (shared by the side panel and the background worker).
const chromeStorage = {
  getItem: async (key: string) => ((await chrome.storage.local.get(key))[key] as string | undefined) ?? null,
  setItem: async (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
  removeItem: async (key: string) => chrome.storage.local.remove(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: chromeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
