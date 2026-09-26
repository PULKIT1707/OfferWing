import type { JobMatch } from "@/lib/agents/job-match";
import type { ScoredConnection } from "@/lib/agents/referral-scout";

export type Me = {
  name: string | null;
  onboarded: boolean;
  aiMode: "starter" | "private" | "cloud";
  aiProvider: "openai" | "anthropic" | "gemini" | null;
  targetRoles: string[];
  hasResume: boolean;
  connectionsImported: boolean;
};

export type Person = ScoredConnection & { listStatus: string | null };

export type Lookup = {
  company: string | null;
  isTarget: boolean;
  isExcluded: boolean;
  job: { id: string; title: string; company: string; stage: string; fit_score: number | null; hasDescription: boolean } | null;
  match: { status: "running" | "complete" | "failed"; result: JobMatch | null; error: string | null; created_at: string } | null;
  connection: Person | null;
  people: Person[];
  jobsAtCompany: { id: string; title: string; stage: string; fit_score: number | null }[];
};
