import { describe, expect, it } from "vitest";
import { calibrate } from "./calibration";

const jobs = (score: number, n: number, reached: number) => Array.from({ length: n }, () => ({ fit_score: score, reached }));

describe("calibrate", () => {
  it("needs enough scored applications", () => {
    const c = calibrate([...jobs(90, 3, 2), { fit_score: null, reached: 1 }, ...jobs(60, 2, 0)]);
    expect(c.enough).toBe(false);
    expect(c.scored).toBe(3);
    expect(c.unscored).toBe(1);
  });

  it("counts responses and interviews per band", () => {
    const c = calibrate([...jobs(90, 4, 3), ...jobs(88, 1, 1), ...jobs(75, 5, 2), ...jobs(40, 2, 1)]);
    expect(c.enough).toBe(true);
    expect(c.bands.find((b) => b.verdict === "strong")).toMatchObject({ applied: 5, responded: 4, interviewed: 4 });
    expect(c.bands.find((b) => b.verdict === "good")).toMatchObject({ applied: 5, responded: 5, interviewed: 0 });
    expect(c.bands.find((b) => b.verdict === "weak")).toMatchObject({ applied: 2, responded: 0 });
  });

  it("flags a lower band out-performing a higher one only with enough data in both", () => {
    const inverted = calibrate([...jobs(90, 5, 1), ...jobs(60, 5, 2)]);
    expect(inverted.inverted).toEqual({ better: "stretch", worse: "strong" });
    expect(calibrate([...jobs(90, 9, 1), ...jobs(60, 4, 2)]).inverted).toBeNull();
    expect(calibrate([...jobs(90, 5, 2), ...jobs(60, 5, 1)]).inverted).toBeNull();
  });
});
