# Golden-set evals

Measures how well each AI provider and tier holds up on Job Match, so routing a task to a cheaper
model is a number rather than a guess. Run from `apps/web`:

```bash
npm run eval:golden                                    # offline: fixtures + code-side gates, free
OFFERWING_EVAL_OPENAI_API_KEY=sk-... npm run eval:golden
OFFERWING_EVAL_ANTHROPIC_API_KEY=... OFFERWING_EVAL_GEMINI_API_KEY=... \
  OFFERWING_EVAL_TIERS=fast,standard npm run eval:golden
```

- `golden/candidate.md` is one synthetic candidate; `golden/cases.json` holds synthetic postings,
  the candidate's preferences, and a label per case.
- Labels are ranges a careful recruiter would accept (verdict "good" or "stretch", legitimacy
  "suspicious"), so the metric is agreement with a reasonable answer, not with one model's output.
- Each live run writes a Markdown table to `evals/results/` (gitignored): verdict agreement,
  legitimacy, whether code-found dealbreakers survived, and whether embedded instructions were
  reported instead of obeyed.
- The eval reports and never fails the build: a weak model is a routing decision.
- Model names come from `src/lib/llm/models.ts`, so `OFFERWING_<PROVIDER>_MODEL_<TIER>` overrides
  are what get measured.

Add a case when a real posting is scored badly: write a synthetic version of it with its label.
