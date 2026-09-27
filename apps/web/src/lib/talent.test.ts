import { describe, expect, it } from "vitest";
import { allTerms, findIdentifying, identityTerms, scrubIdentity } from "./talent";

const identity = identityTerms({ fullName: "Ada Lovelace", employers: ["Analytical Engines Ltd", "Acme", "University of London"] });
const terms = allTerms(identity);

describe("identityTerms", () => {
  it("includes name parts and distinctive employer words, longest first", () => {
    expect(terms).toContain("Lovelace");
    expect(terms).toContain("Analytical Engines Ltd");
    expect(terms).toContain("Analytical");
    expect(terms).not.toContain("Ltd");
    expect(terms).not.toContain("University");
    expect(terms.indexOf("Analytical Engines Ltd")).toBeLessThan(terms.indexOf("Analytical"));
  });
});

describe("findIdentifying / scrubIdentity", () => {
  it("finds and removes names, employers and contact details", () => {
    const text = "Ada led design at Acme and Analytical Engines Ltd. Reach her at ada@example.com or +44 20 7946 0958, linkedin.com/in/ada.";
    expect(findIdentifying(text, terms)).toEqual(expect.arrayContaining(["Ada", "Acme", "Analytical Engines Ltd", "an email address", "a phone number", "a link"]));
    const clean = scrubIdentity(text, identity);
    expect(findIdentifying(clean, terms)).toEqual([]);
    expect(clean).toContain("[email]");
    expect(clean.startsWith("the candidate led design at a previous employer")).toBe(true);
  });
  it("doesn't match inside other words", () => {
    expect(findIdentifying("Worked on acmeology research", ["Acme"])).toEqual([]);
    expect(scrubIdentity("Built pharmacy tools", { names: [], orgs: ["Acme"] })).toBe("Built pharmacy tools");
  });
});
