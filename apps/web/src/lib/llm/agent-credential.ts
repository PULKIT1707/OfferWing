import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCredential, type Credential } from "./credentials";
import { UserFacingError } from "./errors";
import { AGENT_DAILY_LIMITS, agentRunsLeft, type AgentName } from "./quota";

const LABEL: Record<AgentName, string> = {
  content_plan: "content plans",
  post_draft: "post drafts",
  comment_ideas: "comment suggestions",
  story_bank: "story bank builds",
  weekly_plan: "weekly plans",
};

// The user's AI credential for an agent run, or a friendly error (no key / Starter limit reached).
export async function credentialForAgent(supabase: SupabaseClient, userId: string, agent: AgentName): Promise<Credential | { error: string }> {
  try {
    const credential = await resolveCredential(supabase, userId);
    if (credential.source === "starter" && !(await agentRunsLeft(supabase, agent))) {
      return { error: `Starter includes ${AGENT_DAILY_LIMITS[agent]} ${LABEL[agent]} a day. Add your own AI key in Settings for unlimited use.` };
    }
    return credential;
  } catch (err) {
    if (err instanceof UserFacingError) return { error: err.message };
    throw err;
  }
}
