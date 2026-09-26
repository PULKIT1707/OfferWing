import { describe, expect, it } from "vitest";
import { dateInZone, isValidTimeZone, weekStartInZone } from "./time";

// 2026-09-26 03:30 UTC is still Sep 25 in Los Angeles and already Sep 26 in Tokyo.
const now = new Date("2026-09-26T03:30:00Z");

describe("time zones", () => {
  it("returns the local calendar date", () => {
    expect(dateInZone("America/Los_Angeles", 0, now)).toBe("2026-09-25");
    expect(dateInZone("Asia/Tokyo", 0, now)).toBe("2026-09-26");
    expect(dateInZone(null, 0, now)).toBe("2026-09-26");
    expect(dateInZone("Not/AZone", 0, now)).toBe("2026-09-26");
  });
  it("adds days across month ends", () => {
    expect(dateInZone("America/Los_Angeles", 7, now)).toBe("2026-10-02");
    expect(dateInZone("UTC", -30, now)).toBe("2026-08-27");
  });
  it("finds the Monday of the week", () => {
    expect(weekStartInZone("America/Los_Angeles", now)).toBe("2026-09-21"); // Friday Sep 25 → Monday Sep 21
    expect(weekStartInZone("UTC", new Date("2026-09-28T10:00:00Z"))).toBe("2026-09-28"); // a Monday
  });
  it("validates zone names", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
