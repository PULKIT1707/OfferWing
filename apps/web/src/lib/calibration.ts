import { VERDICT_BANDS, verdictFor, type JobMatch } from "@/lib/agents/job-match";

// Does the fit score predict what actually happens? Groups applied jobs by score band and compares
// how often each band got a response (screen or further) and an interview. Advisory only: it never
// changes how jobs are scored.

export type BandOutcome = { verdict: JobMatch["verdict"]; min: number; applied: number; responded: number; interviewed: number };
export type Calibration = {
  bands: BandOutcome[];
  scored: number;
  unscored: number;
  // True when there are enough applications to say anything at all.
  enough: boolean;
  // A lower band out-performing a higher one, each with at least MIN_PER_BAND applications.
  inverted: { better: JobMatch["verdict"]; worse: JobMatch["verdict"] } | null;
};

export const MIN_APPLIED = 10;
export const MIN_PER_BAND = 5;

// `reached`: 1 applied, 2 screen, 3 interview, 4 offer (as on the insights funnel).
export function calibrate(jobs: { fit_score: number | null; reached: number }[]): Calibration {
  const applied = jobs.filter((j) => j.reached >= 1);
  const scored = applied.filter((j) => j.fit_score != null);
  const bands: BandOutcome[] = VERDICT_BANDS.map((b) => {
    const inBand = scored.filter((j) => verdictFor(j.fit_score!) === b.verdict);
    return {
      verdict: b.verdict,
      min: b.min,
      applied: inBand.length,
      responded: inBand.filter((j) => j.reached >= 2).length,
      interviewed: inBand.filter((j) => j.reached >= 3).length,
    };
  });
  const rate = (b: BandOutcome) => b.responded / b.applied;
  let inverted: Calibration["inverted"] = null;
  // Bands are ordered best first; compare each pair of bands with enough data.
  outer: for (let i = 0; i < bands.length; i++) {
    for (let k = i + 1; k < bands.length; k++) {
      const hi = bands[i];
      const lo = bands[k];
      if (hi.applied >= MIN_PER_BAND && lo.applied >= MIN_PER_BAND && rate(lo) > rate(hi)) {
        inverted = { better: lo.verdict, worse: hi.verdict };
        break outer;
      }
    }
  }
  return { bands, scored: scored.length, unscored: applied.length - scored.length, enough: scored.length >= MIN_APPLIED, inverted };
}
