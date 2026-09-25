import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provider } from "@/lib/onboarding";
import { UserFacingError } from "./errors";

export type Credential = { source: "starter" | "cloud"; provider: Provider; apiKey: string };

export const STARTER_DAILY_AUDITS = 2;

// Picks the key an agent run should use, based on the user's AI mode.
export async function resolveCredential(supabase: SupabaseClient, userId: string): Promise<Credential> {
  const { data: ai } = await supabase.from("ai_settings").select("mode, provider").eq("user_id", userId).single();

  if (ai?.mode === "private") {
    throw new UserFacingError(
      "Your key lives in the Offerwing browser extension, which isn't available yet. Switch to Starter or Always-on in Settings → AI & keys to run agents from the web.",
    );
  }

  if (ai?.mode === "cloud" && ai.provider) {
    const admin = createAdminClient();
    if (!admin) throw new UserFacingError("Always-on keys aren't enabled on this server yet (missing SUPABASE_SERVICE_ROLE_KEY).");
    const { data: key, error } = await admin.rpc("get_user_ai_key", { p_user_id: userId });
    if (error || !key) throw new UserFacingError("Couldn't read your saved AI key. Re-enter it in Settings → AI & keys.");
    return { source: "cloud", provider: ai.provider as Provider, apiKey: key as string };
  }

  const starterKey = process.env.OFFERWING_STARTER_ANTHROPIC_API_KEY;
  if (!starterKey) {
    throw new UserFacingError("Starter credits aren't available right now. Add your own AI key in Settings → AI & keys.");
  }
  return { source: "starter", provider: "anthropic", apiKey: starterKey };
}
