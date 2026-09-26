import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/onboarding";
import { buildContentPlanPrompt, linkedInShareUrl } from "./content";

describe("content", () => {
  it("builds a pre-filled LinkedIn share link", () => {
    expect(linkedInShareUrl("Hello & welcome #design")).toBe("https://www.linkedin.com/feed/?shareActive=true&text=Hello%20%26%20welcome%20%23design");
  });
  it("keeps stealth-mode users discreet", () => {
    expect(buildContentPlanPrompt({ ...DEFAULT_PROFILE, search_mode: "stealth" }, null)).toContain("never mention looking for a job");
    expect(buildContentPlanPrompt({ ...DEFAULT_PROFILE, search_mode: "open" }, null)).not.toContain("never mention looking for a job");
  });
});
