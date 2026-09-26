import { describe, expect, it } from "vitest";
import { companyKey, sameCompany } from "./dashboard";

describe("companyKey", () => {
  it("normalizes legal suffixes, punctuation and leading 'The'", () => {
    expect(companyKey("Stripe, Inc.")).toBe("stripe");
    expect(companyKey("Google LLC")).toBe("google");
    expect(companyKey("The Walt Disney Company")).toBe("walt disney");
    expect(companyKey("AT&T")).toBe("at and t");
    expect(companyKey(null)).toBeNull();
  });
  it("compares companies loosely", () => {
    expect(sameCompany("Stripe", "stripe, inc.")).toBe(true);
    expect(sameCompany("Stripe", "Square")).toBe(false);
    expect(sameCompany(null, "Stripe")).toBe(false);
  });
});
