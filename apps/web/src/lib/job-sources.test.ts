import { describe, expect, it } from "vitest";
import { mapAshby, mapGreenhouse, mapLever, matchesTargetRoles, nameFromToken, parseCareersUrl } from "./job-sources";

describe("parseCareersUrl", () => {
  it("recognizes Greenhouse, Lever and Ashby boards", () => {
    expect(parseCareersUrl("https://boards.greenhouse.io/stripe")).toEqual({ kind: "greenhouse", token: "stripe" });
    expect(parseCareersUrl("job-boards.greenhouse.io/figma/jobs/123")).toEqual({ kind: "greenhouse", token: "figma" });
    expect(parseCareersUrl("https://boards-api.greenhouse.io/v1/boards/acme/jobs")).toEqual({ kind: "greenhouse", token: "acme" });
    expect(parseCareersUrl("https://jobs.lever.co/netflix/abc-123")).toEqual({ kind: "lever", token: "netflix" });
    expect(parseCareersUrl("https://jobs.ashbyhq.com/linear")).toEqual({ kind: "ashby", token: "linear" });
  });
  it("rejects other sites and bad tokens", () => {
    expect(parseCareersUrl("https://stripe.com/jobs")).toBeNull();
    expect(parseCareersUrl("https://jobs.lever.co/")).toBeNull();
    expect(parseCareersUrl("not a url at all")).toBeNull();
  });
});

describe("board mapping", () => {
  it("maps Greenhouse jobs and unescapes descriptions", () => {
    const [p] = mapGreenhouse("stripe", { jobs: [{ id: 7, title: "Product Designer", absolute_url: "https://x/7", location: { name: "Remote" }, content: "&lt;p&gt;Design &amp;amp; build&lt;/p&gt;" }] });
    expect(p).toEqual({ externalId: "greenhouse:stripe:7", title: "Product Designer", location: "Remote", url: "https://x/7", description: "Design & build" });
  });
  it("maps Lever jobs with their lists", () => {
    const [p] = mapLever("figma", [{ id: "a1", text: "Designer", hostedUrl: "https://l/a1", categories: { location: "NYC" }, descriptionPlain: "About us", lists: [{ text: "Requirements", content: "<li>Figma</li>" }] }]);
    expect(p.externalId).toBe("lever:figma:a1");
    expect(p.description).toContain("Requirements\nFigma");
  });
  it("skips unlisted Ashby jobs", () => {
    const out = mapAshby("linear", { jobs: [{ id: "1", title: "A", jobUrl: "u", isListed: true }, { id: "2", title: "B", jobUrl: "u", isListed: false }] });
    expect(out.map((p) => p.title)).toEqual(["A"]);
  });
});

describe("matchesTargetRoles", () => {
  it("matches on the role's head noun", () => {
    expect(matchesTargetRoles("Staff Product Designer", ["Senior Product Designer"])).toBe(true);
    expect(matchesTargetRoles("Design Systems Designer", ["Product Designer"])).toBe(true);
    expect(matchesTargetRoles("Software Engineer, Payments", ["Senior Software Engineer"])).toBe(true);
    expect(matchesTargetRoles("Designer, Web Presence & Platform", ["Senior Product Designer"])).toBe(true);
    expect(matchesTargetRoles("Senior / Staff Fullstack Engineer", ["Software Engineer"])).toBe(true);
    expect(matchesTargetRoles("Account Executive", ["Product Designer"])).toBe(false);
    expect(matchesTargetRoles("Design Program Manager, Research Operations", ["Product Designer"])).toBe(false);
    expect(matchesTargetRoles("Design Engineer, Expansion", ["Product Designer"])).toBe(false);
    expect(matchesTargetRoles("Creative Director, Event Design", ["Product Designer"])).toBe(false);
    expect(matchesTargetRoles("Anything", [])).toBe(true);
  });
  it("names companies from tokens", () => expect(nameFromToken("acme-corp")).toBe("Acme Corp"));
});
