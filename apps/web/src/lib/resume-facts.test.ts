import { describe, expect, it } from "vitest";
import { extractResumeFacts, yearsOfExperience } from "./resume-facts";

const NOW = new Date("2026-09-30T12:00:00Z");

const RESUME = `Ada Lovelace
Senior Product Designer · London, UK
ada.lovelace@example.com | +44 20 7946 0958 | linkedin.com/in/ada-lovelace | github.com/ada | adalovelace.design

EXPERIENCE
Analytical Engines Ltd — Senior Product Designer          Mar 2021 – Present
Babbage & Co — Product Designer                             2017 - 2021
Led a team of 6; grew conversion 35% in 2022.

EDUCATION
University of London, BSc Mathematics                      2013 – 2016`;

describe("extractResumeFacts", () => {
  it("reads contact details and links", () => {
    expect(extractResumeFacts(RESUME, NOW)).toEqual({
      email: "ada.lovelace@example.com",
      phone: "+44 20 7946 0958",
      linkedinUrl: "https://linkedin.com/in/ada-lovelace",
      githubUrl: "https://github.com/ada",
      websiteUrl: "https://adalovelace.design",
      yearsExperience: 9,
    });
  });

  it("returns nulls when there's nothing to find", () => {
    expect(extractResumeFacts("Just some words about design.", NOW)).toEqual({
      email: null,
      phone: null,
      linkedinUrl: null,
      githubUrl: null,
      websiteUrl: null,
      yearsExperience: null,
    });
  });

  it("doesn't mistake year ranges for phone numbers", () => {
    expect(extractResumeFacts("Worked 2019 - 2023 2024 at a bank", NOW).phone).toBeNull();
  });

  it("reads LinkedIn PDF style URLs", () => {
    expect(extractResumeFacts("Contact\nwww.linkedin.com/in/jane-doe-12ab (LinkedIn)", NOW).linkedinUrl).toBe("https://www.linkedin.com/in/jane-doe-12ab");
  });
});

describe("yearsOfExperience", () => {
  it("uses the earliest start and treats Present as now", () => {
    expect(yearsOfExperience("June 2020 – Present\n2018 to 2020", NOW)).toBe(8);
  });
  it("doesn't count education", () => {
    expect(yearsOfExperience("EXPERIENCE\nDesigner 2020 - Present\nEDUCATION\nBSc 2012 - 2016\nSKILLS\nFigma", NOW)).toBe(6);
  });
  it("ignores backwards and future ranges", () => {
    expect(yearsOfExperience("2024 - 2019\n2030 - present", NOW)).toBeNull();
  });
});
