// Starter daily limits per agent. The database (public.starter_limits, migration 0018) is the
// authority; this copy is for messages in the UI. starter-ledger.test.ts fails if they drift.
export const STARTER_LIMITS = {
  profile_audit: 2,
  job_match: 20,
  application_kit: 5,
  outreach_draft: 20,
  interview_prep: 5,
  practice_answer: 20,
  negotiation: 5,
  content_plan: 3,
  post_draft: 10,
  comment_ideas: 20,
  story_bank: 3,
  weekly_plan: 3,
  form_answers: 10,
  referral_packet: 10,
  talent_profile: 3,
  profile_prefill: 5,
} as const;

export type StarterAgent = keyof typeof STARTER_LIMITS;

const LABEL: Record<StarterAgent, string> = {
  profile_audit: "profile audits",
  job_match: "job scores",
  application_kit: "application kits",
  outreach_draft: "drafts",
  interview_prep: "prep packs",
  practice_answer: "practice answers",
  negotiation: "negotiation plans",
  content_plan: "content plans",
  post_draft: "post drafts",
  comment_ideas: "comment suggestions",
  story_bank: "story bank builds",
  weekly_plan: "weekly plans",
  form_answers: "application answer drafts",
  referral_packet: "referral packets",
  talent_profile: "talent profile builds",
  profile_prefill: "resume readings",
};

export function starterLimitMessage(agent: StarterAgent): string {
  return `Starter includes ${STARTER_LIMITS[agent]} ${LABEL[agent]} a day. Add your own AI key in Settings for unlimited use.`;
}
