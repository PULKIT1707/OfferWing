import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapAshby, mapGreenhouse, mapLever, mapRecruitee, mapSmartRecruiters, mapWorkable, matchesTargetRoles, nameFromToken, normalizeJobUrl, parseCareersUrl, smartRecruitersDescription, SOURCE_KINDS, titleExcluded, withDetails } from "./job-sources";

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

describe("more sources", () => {
  it("recognizes SmartRecruiters, Workable and Recruitee boards", () => {
    expect(parseCareersUrl("https://jobs.smartrecruiters.com/BoschGroup")).toEqual({ kind: "smartrecruiters", token: "BoschGroup" });
    expect(parseCareersUrl("careers.smartrecruiters.com/Visa/jobs")).toEqual({ kind: "smartrecruiters", token: "Visa" });
    expect(parseCareersUrl("https://api.smartrecruiters.com/v1/companies/Acme/postings")).toEqual({ kind: "smartrecruiters", token: "Acme" });
    expect(parseCareersUrl("https://apply.workable.com/huggingface/")).toEqual({ kind: "workable", token: "huggingface" });
    expect(parseCareersUrl("https://acme.workable.com")).toEqual({ kind: "workable", token: "acme" });
    expect(parseCareersUrl("https://apply.workable.com/api/v1/widget/accounts/acme")).toEqual({ kind: "workable", token: "acme" });
    expect(parseCareersUrl("https://bunq.recruitee.com/o/head-of-product")).toEqual({ kind: "recruitee", token: "bunq" });
  });

  it("rejects job links without a board, reserved subdomains and look-alikes", () => {
    expect(parseCareersUrl("https://apply.workable.com/j/ABC123")).toBeNull();
    expect(parseCareersUrl("https://www.workable.com")).toBeNull();
    expect(parseCareersUrl("https://app.recruitee.com")).toBeNull();
    expect(parseCareersUrl("https://acme.recruitee.com.evil.io")).toBeNull();
    expect(parseCareersUrl("https://evil.io/?u=https://jobs.smartrecruiters.com/Acme")).toBeNull();
  });

  it("maps SmartRecruiters listings and reads descriptions from the detail call", () => {
    const [p] = mapSmartRecruiters("Bosch", { content: [{ id: "744", name: " Analyst ", location: { city: "Queretaro", country: "mx" } }] });
    expect(p).toEqual({ externalId: "smartrecruiters:Bosch:744", title: "Analyst", location: "Queretaro, MX", url: "https://jobs.smartrecruiters.com/Bosch/744", description: null });
    const d = smartRecruitersDescription({ jobAd: { sections: { jobDescription: { title: "About", text: "<p>Build &amp; ship</p>" }, qualifications: { text: "<ul><li>SQL</li></ul>" } } } });
    expect(d).toContain("About\nBuild & ship");
    expect(d).toContain("SQL");
  });

  it("maps Workable and Recruitee jobs", () => {
    const [w] = mapWorkable("hf", { jobs: [{ title: "ML Engineer", shortcode: "AB12", url: "https://apply.workable.com/j/AB12", city: "Paris", country: "France", telecommuting: true, description: "<p>Hi</p>" }] });
    expect(w).toEqual({ externalId: "workable:hf:AB12", title: "ML Engineer", location: "Remote · Paris, France", url: "https://apply.workable.com/j/AB12", description: "Hi" });
    const r = mapRecruitee("bunq", { offers: [{ id: 1, title: "PM", careers_url: "https://c/o/pm", location: "Amsterdam", description: "<p>A</p>", requirements: "<p>B</p>" }, { id: 2, title: "Old", careers_url: "u", status: "closed" }] });
    expect(r).toEqual([{ externalId: "recruitee:bunq:1", title: "PM", location: "Amsterdam", url: "https://c/o/pm", description: "A\n\nB" }]);
  });

  it("enriches at most `limit` postings that lack a description", async () => {
    const postings = Array.from({ length: 5 }, (_, i) => ({ externalId: `x:t:${i}`, title: "t", location: null, url: `u${i}`, description: i === 0 ? "has one" : null }));
    // Not a SmartRecruiters board: nothing to enrich.
    expect(await withDetails("greenhouse", "t", postings)).toBe(postings);
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ jobAd: { sections: { jobDescription: { text: "<p>JD</p>" } } } }), { status: 200 });
    }) as typeof fetch;
    try {
      const out = await withDetails("smartrecruiters", "t", postings, 2);
      expect(calls).toBe(2);
      expect(out.map((p) => p.description)).toEqual(["has one", "JD", "JD", null, null]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("matches the kinds the database accepts", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/0019_more_job_sources.sql", import.meta.url), "utf8");
    const allowed = [...sql.match(/check \(kind in \(([^)]*)\)\)/)![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(allowed).toEqual([...SOURCE_KINDS]);
  });
});

describe("title exclusions", () => {
  it("skips titles containing an excluded whole word", () => {
    expect(matchesTargetRoles("Interior Designer", ["Product Designer"])).toBe(true);
    expect(matchesTargetRoles("Interior Designer", ["Product Designer"], ["interior"])).toBe(false);
    expect(matchesTargetRoles("Senior Product Designer", ["Product Designer"], ["interior"])).toBe(true);
    expect(titleExcluded("Design Intern (Summer)", ["intern"])).toBe(true);
    expect(titleExcluded("Internal Tools Engineer", ["intern"])).toBe(false);
    expect(titleExcluded("Engineer, Contract-to-hire", ["contract"])).toBe(true);
    expect(matchesTargetRoles("Sales Intern", [], ["intern"])).toBe(false);
  });
});

describe("normalizeJobUrl", () => {
  it("treats tracking variants of one posting as the same URL", () => {
    const a = normalizeJobUrl("https://Jobs.Lever.co/figma/abc/?lever-source=LinkedIn&utm_campaign=x#apply");
    expect(a).toBe("https://jobs.lever.co/figma/abc");
    expect(normalizeJobUrl("https://jobs.lever.co/figma/abc")).toBe(a);
    expect(normalizeJobUrl("https://boards.greenhouse.io/x/jobs/1?gh_src=abc&gh_jid=1")).toBe("https://boards.greenhouse.io/x/jobs/1?gh_jid=1");
    expect(normalizeJobUrl("not a url ")).toBe("not a url");
  });
});
