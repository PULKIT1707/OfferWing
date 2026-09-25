import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only work (e.g. decrypting a user's cloud AI key).
// Returns null when the key isn't configured so callers can explain what's missing.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
