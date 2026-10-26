import { describe, expect, it } from "vitest";
import { buildJobPrompt, confidenceFrom, JOB_MATCH_PROMPT_VERSION, normalizeMatch, verdictFor, type JobMatch } from "./job-match";

const base: JobMatch = {
  fit_score: 77.6,
  verdict: "strong",
  summary: "s",
  matched: [],
  gaps: [],
  preference_conflicts: ["Salary below your minimum"],
  red_flags: [],
  keywords_to_mirror: [],
  recommended_channel: "company_site",
  channel_reason: "r",
  talking_points: [],
  legitimacy: "high_confidence",
  evidence: { skills: "supported", seniority: "supported", preferences: "supported", compensation: "supported" },
  open_questions: [],
  injected_instructions: [],
};

describe("verdictFor", () => {
  it("maps scores to bands", () => {
    expect([100, 85, 84, 70, 69, 50, 49, 0].map(verdictFor)).toEqual(["strong", "strong", "good", "good", "stretch", "stretch", "weak", "weak"]);
  });
});

describe("confidenceFrom", () => {
  const all = (s: "supported" | "partial" | "unknown") => ({ skills: s, seniority: s, preferences: s, compensation: s });
  it("is high only when everything is supported and nothing is open", () => {
    expect(confidenceFrom(all("supported"))).toBe("high");
    expect(confidenceFrom(all("supported"), ["Confirm remote from Canada"])).toBe("medium");
  });
  it("is medium with any partial or a single unknown outside skills", () => {
    expect(confidenceFrom({ ...all("supported"), compensation: "unknown" })).toBe("medium");
    expect(confidenceFrom({ ...all("supported"), seniority: "partial" })).toBe("medium");
  });
  it("is low when the skills evidence is unknown or two dimensions are", () => {
    expect(confidenceFrom({ ...all("supported"), skills: "unknown" })).toBe("low");
    expect(confidenceFrom({ ...all("supported"), compensation: "unknown", preferences: "unknown" })).toBe("low");
  });
  it("is undefined for results without evidence (version 1)", () => {
    expect(confidenceFrom(undefined)).toBeUndefined();
  });
});

describe("normalizeMatch", () => {
  it("clamps and rounds the score and makes the verdict agree with it", () => {
    const m = normalizeMatch(base);
    expect(m.fit_score).toBe(78);
    expect(m.verdict).toBe("good");
    expect(normalizeMatch({ ...base, fit_score: 140 }).fit_score).toBe(100);
    expect(normalizeMatch({ ...base, fit_score: -3 }).verdict).toBe("weak");
  });

  it("keeps conflicts found by code first and drops duplicates", () => {
    const m = normalizeMatch({ ...base, preference_conflicts: ["salary below your minimum", "Not remote"] }, ["Salary below your minimum"]);
    expect(m.preference_conflicts).toEqual(["Salary below your minimum", "Not remote"]);
  });

  it("caps open questions at three and derives confidence", () => {
    const m = normalizeMatch({ ...base, open_questions: ["a", "b", "c", "d"] });
    expect(m.open_questions).toEqual(["a", "b", "c"]);
    expect(m.confidence).toBe("medium");
    expect(m.prompt_version).toBe(JOB_MATCH_PROMPT_VERSION);
  });

  it("tags results without the version-2 fields as version 1", () => {
    const { legitimacy, evidence, open_questions, injected_instructions, ...v1 } = base;
    void [legitimacy, evidence, open_questions, injected_instructions];
    const m = normalizeMatch(v1);
    expect(m.prompt_version).toBe("1");
    expect(m.confidence).toBeUndefined();
    expect(m.injected_instructions).toEqual([]);
  });
});

describe("buildJobPrompt", () => {
  it("passes conflicts found by code to the model", () => {
    const p = buildJobPrompt({ title: "PM", company: "Acme", location: null, description: "d" }, 2, ["No sponsorship"]);
    expect(p).toContain("Conflicts found by code (keep these): No sponsorship");
    expect(buildJobPrompt({ title: "PM", company: "Acme", location: null, description: "d" }, 0)).not.toContain("Conflicts found by code");
  });
});
