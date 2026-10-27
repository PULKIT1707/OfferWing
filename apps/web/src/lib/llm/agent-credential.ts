import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCredential, type Credential } from "./credentials";
import { UserFacingError } from "./errors";
import { claimStarterRuns, starterLimitMessage, type StarterAgent } from "./quota";

// The user's AI credential for `count` runs of one agent, or a friendly error (no key / Starter
// limit reached). On Starter the runs are claimed in the ledger up front, so the limit holds even
// under parallel requests. A batch may get fewer claims than asked: check credential.starterClaims.
export async function credentialForAgent(supabase: SupabaseClient, userId: string, agent: StarterAgent, count = 1): Promise<Credential | { error: string }> {
  try {
    const credential = await resolveCredential(supabase, userId);
    if (credential.source !== "starter") return credential;
    const claims = await claimStarterRuns(supabase, agent, count);
    if (!claims.length) return { error: starterLimitMessage(agent) };
    return { ...credential, starterClaims: claims };
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
}

// How many runs a credential from credentialForAgent() may make: its claims on Starter, `wanted` otherwise.
export const allowedRuns = (credential: Credential, wanted: number) =>
  credential.source === "starter" ? (credential.starterClaims?.length ?? 0) : wanted;
