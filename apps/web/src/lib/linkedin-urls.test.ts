import { describe, expect, it } from "vitest";
import { canonicalJobUrl, normalizeProfileUrl, pageKind } from "./linkedin-urls";

describe("LinkedIn URLs", () => {
  it("canonicalizes job URLs from view, search and tracking links", () => {
    expect(canonicalJobUrl("https://www.linkedin.com/jobs/view/4012345678/?refId=x")).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalJobUrl("https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=a")).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalJobUrl("https://www.linkedin.com/comm/jobs/view/4012345678/?trackingId=abc")).toBe("https://www.linkedin.com/jobs/view/4012345678/");
    expect(canonicalJobUrl("https://evil.example.com/jobs/view/1/")).toBeNull();
    expect(canonicalJobUrl("not a url")).toBeNull();
  });
  it("normalizes profile URLs", () => {
    expect(normalizeProfileUrl("https://www.linkedin.com/in/Priya-Shah/?miniProfile=1")).toBe("https://www.linkedin.com/in/priya-shah");
    expect(normalizeProfileUrl("https://example.com")).toBeNull();
  });
  it("detects page kinds", () => {
    expect(pageKind("https://www.linkedin.com/jobs/view/1/")).toBe("job");
    expect(pageKind("https://www.linkedin.com/in/someone/")).toBe("profile");
    expect(pageKind("https://www.linkedin.com/company/stripe/")).toBe("company");
    expect(pageKind("https://www.linkedin.com/feed/")).toBe("other");
  });
});
