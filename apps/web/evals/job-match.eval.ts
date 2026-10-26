// Golden-set eval for the Job Match agent: which provider and tier can be trusted to score jobs?
//
//   npm run eval:golden                         # offline: checks fixtures and the code-side gates
//   OFFERWING_EVAL_OPENAI_API_KEY=sk-... npm run eval:golden
//   OFFERWING_EVAL_ANTHROPIC_API_KEY=... OFFERWING_EVAL_GEMINI_API_KEY=... OFFERWING_EVAL_TIERS=fast,standard npm run eval:golden
//
// Each case is a synthetic posting scored against one synthetic candidate. Labels are ranges a
// careful recruiter would accept (e.g. verdict "good" or "stretch"), not one exact number, so the
// metric is agreement with a reasonable answer rather than with one model's past output.
// Results go to evals/results/ (gitignored). Live runs call the real APIs and cost tokens.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectDealbreakers } from "@/lib/agents/job-gates";
import { buildCandidateContext, buildJobPrompt, JOB_MATCH_PROMPT_VERSION, JOB_MATCH_SYSTEM, jobMatchSchema, normalizeMatch, type JobMatch } from "@/lib/agents/job-match";
import type { Credential } from "@/lib/llm/credentials";
import { generateStructured } from "@/lib/llm/generate";
import { modelFor, type Tier } from "@/lib/llm/models";
import { withDefaults, type Provider } from "@/lib/onboarding";

type Label = { verdicts: JobMatch["verdict"][]; legitimacy: NonNullable<JobMatch["legitimacy"]>[]; dealbreaker: boolean; injection?: boolean };
type Case = { id: string; note: string; job: { title: string; company: string; location: string | null }; description: string; label: Label };
type Golden = { candidate: { file: string; preferences: Record<string, unknown> }; cases: Case[] };

const dir = new URL("./golden/", import.meta.url);
const golden = JSON.parse(readFileSync(new URL("cases.json", dir), "utf8")) as Golden;
const careerText = readFileSync(new URL(golden.candidate.file, dir), "utf8");
const prefs = withDefaults(golden.candidate.preferences);

const PROVIDERS: Provider[] = ["anthropic", "openai", "gemini"];
const keyFor = (p: Provider) => process.env[`OFFERWING_EVAL_${p.toUpperCase()}_API_KEY`];
const tiers = (process.env.OFFERWING_EVAL_TIERS ?? "fast").split(",").map((t) => t.trim()) as Tier[];
const targets = PROVIDERS.filter(keyFor).flatMap((provider) => tiers.map((tier) => ({ provider, tier })));

type Outcome = { id: string; verdict: string; score: number; verdictOk: boolean; legitimacyOk: boolean; dealbreakerOk: boolean; injectionOk: boolean | null; error?: string };

function grade(c: Case, m: JobMatch, conflicts: string[]): Outcome {
  return {
    id: c.id,
    verdict: m.verdict,
    score: m.fit_score,
    verdictOk: c.label.verdicts.includes(m.verdict),
    legitimacyOk: !!m.legitimacy && c.label.legitimacy.includes(m.legitimacy),
    dealbreakerOk: c.label.dealbreaker ? m.preference_conflicts.some((x) => conflicts.includes(x)) : true,
    injectionOk: c.label.injection ? (m.injected_instructions?.length ?? 0) > 0 && m.fit_score < 100 : null,
  };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

function report(provider: Provider, tier: Tier, outcomes: Outcome[]): string {
  const ok = outcomes.filter((o) => !o.error);
  const inj = ok.filter((o) => o.injectionOk !== null);
  const rows = outcomes.map(
    (o) =>
      `| ${o.id} | ${o.error ? `error: ${o.error.slice(0, 60)}` : `${o.verdict} (${o.score})`} | ${o.verdictOk ? "✓" : "✗"} | ${o.legitimacyOk ? "✓" : "✗"} | ${o.dealbreakerOk ? "✓" : "✗"} | ${o.injectionOk === null ? "" : o.injectionOk ? "✓" : "✗"} |`,
  );
  return [
    `## ${provider} · ${tier} · ${modelFor(provider, tier)}`,
    "",
    `Verdict agreement ${pct(ok.filter((o) => o.verdictOk).length, outcomes.length)} · legitimacy ${pct(ok.filter((o) => o.legitimacyOk).length, outcomes.length)} · injection reported ${pct(inj.filter((o) => o.injectionOk).length, inj.length)} · errors ${outcomes.length - ok.length}`,
    "",
    "| Case | Result | Verdict | Legitimacy | Dealbreaker kept | Injection |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

describe("golden set", () => {
  it("has well-formed cases", () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(golden.cases.map((c) => c.id)).size).toBe(golden.cases.length);
    for (const c of golden.cases) expect(c.label.verdicts.length).toBeGreaterThan(0);
  });

  // Offline and free: the code-side gate must catch exactly the cases labelled as dealbreakers.
  it.each(golden.cases)("code-side gates agree with the label: $id", (c) => {
    expect(detectDealbreakers(c.description, prefs).length > 0).toBe(c.label.dealbreaker);
  });
});

describe.skipIf(targets.length === 0)("live models", () => {
  it.each(targets)(
    "$provider · $tier",
    async ({ provider, tier }) => {
      const context = buildCandidateContext(prefs, careerText);
      const outcomes: Outcome[] = [];
      for (const c of golden.cases) {
        const credential: Credential = { source: "cloud", provider, apiKey: keyFor(provider)! };
        const conflicts = detectDealbreakers(c.description, prefs);
        try {
          const r = await generateStructured({
            credential,
            tier,
            system: JOB_MATCH_SYSTEM,
            context,
            prompt: buildJobPrompt({ ...c.job, description: c.description }, 0, conflicts),
            schema: jobMatchSchema,
            schemaName: "job_match",
          });
          outcomes.push(grade(c, normalizeMatch(r.data, conflicts), conflicts));
        } catch (err) {
          outcomes.push({ id: c.id, verdict: "", score: 0, verdictOk: false, legitimacyOk: false, dealbreakerOk: false, injectionOk: null, error: (err as Error).message });
        }
      }
      const md = report(provider, tier, outcomes);
      const out = new URL("./results/", import.meta.url);
      mkdirSync(out, { recursive: true });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      writeFileSync(new URL(`job-match-v${JOB_MATCH_PROMPT_VERSION}-${provider}-${tier}-${stamp}.md`, out), `# Job Match golden eval\n\n${md}`);
      console.log(md);
      // Reports, never gates: a model below the bar is a routing decision, not a broken build.
      expect(outcomes.length).toBe(golden.cases.length);
    },
    600_000,
  );
});
