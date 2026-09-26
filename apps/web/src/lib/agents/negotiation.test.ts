import { describe, expect, it } from "vitest";
import { normalizeFeedback } from "./interviews";
import { firstYearCash } from "./negotiation";

describe("offers", () => {
  it("adds base, bonus and sign-on for first-year cash", () => {
    expect(firstYearCash({ base_salary: 180000, bonus_target: 18000, sign_on: 20000 })).toBe(218000);
    expect(firstYearCash({ base_salary: 150000, bonus_target: null, sign_on: null })).toBe(150000);
    expect(firstYearCash({ base_salary: null, bonus_target: 1, sign_on: 1 })).toBeNull();
  });
  it("clamps practice scores to 1-10", () => {
    const f = { score: 0, strengths: [], improvements: [], structure: "", stronger_answer: "" };
    expect(normalizeFeedback({ ...f, score: 14.2 }).score).toBe(10);
    expect(normalizeFeedback(f).score).toBe(1);
  });
});
