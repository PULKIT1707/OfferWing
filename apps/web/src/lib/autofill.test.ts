import { describe, expect, it } from "vitest";
import { atsRef, authorizedFor, classifyField, pickOption, planFill, type AutofillData, type FormField } from "./autofill";

const field = (label: string, over: Partial<FormField> = {}): FormField => ({
  frameId: 0,
  ref: label,
  kind: "text",
  label,
  hints: "",
  required: false,
  options: [],
  hasValue: false,
  ...over,
});

const data: AutofillData = {
  facts: {
    firstName: "Ada",
    lastName: "Lovelace",
    preferredName: null,
    email: "ada@example.com",
    phone: "+1 555 0100",
    city: "London",
    region: null,
    country: "United Kingdom",
    postalCode: null,
    linkedinUrl: "https://www.linkedin.com/in/ada",
    websiteUrl: null,
    githubUrl: "https://github.com/ada",
    portfolioUrl: null,
    currentCompany: "Analytical Engines",
    currentTitle: "Engineer",
    yearsExperience: 8,
    authorizedCountries: ["United Kingdom"],
    needsSponsorship: true,
    openToRelocate: false,
    salary: "90000-110000 GBP",
    noticePeriod: "1 month",
    howHeard: "LinkedIn",
  },
  answers: [{ question: "Why do you want to work at Acme?", answer: "Because of the mission." }],
  coverNote: "Dear team…",
  hasResume: true,
};

describe("atsRef", () => {
  it("recognizes ATS apply pages and builds Job Discovery ids", () => {
    expect(atsRef("https://job-boards.greenhouse.io/stripe/jobs/7045")).toMatchObject({ ats: "greenhouse", externalId: "greenhouse:stripe:7045" });
    expect(atsRef("https://boards.greenhouse.io/embed/job_app?for=figma&token=123")).toMatchObject({ externalId: "greenhouse:figma:123" });
    expect(atsRef("https://stripe.com/jobs/listing/x?gh_jid=555")).toMatchObject({ ats: "greenhouse", jobId: "555", externalId: null });
    expect(atsRef("https://jobs.lever.co/netflix/abc-123/apply")).toMatchObject({ ats: "lever", externalId: "lever:netflix:abc-123" });
    expect(atsRef("https://jobs.ashbyhq.com/linear/9f1/application")).toMatchObject({ ats: "ashby", externalId: "ashby:linear:9f1" });
    expect(atsRef("https://acme.wd5.myworkdayjobs.com/en-US/careers/job/X")).toMatchObject({ ats: "workday", board: "acme" });
    expect(atsRef("https://example.com/careers")).toBeNull();
    expect(atsRef("nonsense")).toBeNull();
  });
});

describe("classifyField", () => {
  it("never answers demographic or consent questions", () => {
    expect(classifyField(field("Gender"))).toBe("demographic");
    expect(classifyField(field("Are you a protected veteran?", { kind: "select" }))).toBe("demographic");
    expect(classifyField(field("I agree to the privacy policy", { kind: "checkbox" }))).toBe("consent");
  });
  it("recognizes common fields by label or by name when unlabeled", () => {
    expect(classifyField(field("First Name"))).toBe("first_name");
    expect(classifyField(field("", { hints: "job_application[last_name]" }))).toBe("last_name");
    expect(classifyField(field("Email address"))).toBe("email");
    expect(classifyField(field("LinkedIn Profile"))).toBe("linkedin");
    expect(classifyField(field("Will you now or in the future require visa sponsorship?"))).toBe("sponsorship");
    expect(classifyField(field("Are you legally authorized to work in the United States?"))).toBe("authorization");
    expect(classifyField(field("Resume/CV", { kind: "file" }))).toBe("resume");
    expect(classifyField(field("Cover Letter", { kind: "file" }))).toBe("cover_letter");
  });
  it("leaves skill-specific experience questions to the kit", () => {
    expect(classifyField(field("How many years of experience do you have with Python?"))).toBeNull();
    expect(classifyField(field("Total years of professional experience"))).toBe("years_experience");
  });
});

describe("authorizedFor", () => {
  it("answers only when the question names a country", () => {
    expect(authorizedFor("Are you authorized to work in the UK?", ["United Kingdom"])).toBe(true);
    expect(authorizedFor("Are you legally authorized to work in the U.S.?", ["United Kingdom"])).toBe(false);
    expect(authorizedFor("Are you authorized to work in the country of this job?", ["United Kingdom"])).toBeNull();
    expect(authorizedFor("Authorized to work in the US?", [])).toBeNull();
  });
});

describe("pickOption", () => {
  it("matches exact, yes/no and close options, ignoring placeholders", () => {
    expect(pickOption(["Select...", "Yes", "No"], "No")).toBe("No");
    expect(pickOption(["United States of America", "United Kingdom"], "United Kingdom")).toBe("United Kingdom");
    expect(pickOption(["--", "Yes, I will", "No, I won't"], "yes")).toBe("Yes, I will");
    expect(pickOption(["Red", "Blue"], "Green")).toBeNull();
  });
});

describe("planFill", () => {
  it("fills known fields, reuses kit answers and lists the rest", () => {
    const plan = planFill(
      [
        field("First Name"),
        field("Last Name"),
        field("Email", { kind: "email" }),
        field("Resume", { kind: "file", required: true }),
        field("Will you require sponsorship?", { kind: "select", options: ["Select...", "Yes", "No"] }),
        field("Are you authorized to work in the United Kingdom?", { kind: "radio", options: ["Yes", "No"] }),
        field("Why do you want to work at Acme?", { kind: "textarea" }),
        field("What's your favourite product and why?", { kind: "textarea" }),
        field("Gender", { kind: "select", options: ["Male", "Female", "Decline"] }),
        field("Phone", { hasValue: true }),
      ],
      data,
    );
    const byLabel = Object.fromEntries(plan.actions.map((a) => [a.label, a.value]));
    expect(byLabel).toEqual({
      "First Name": "Ada",
      "Last Name": "Lovelace",
      Email: "ada@example.com",
      Resume: "resume",
      "Will you require sponsorship?": "Yes",
      "Are you authorized to work in the United Kingdom?": "Yes",
      "Why do you want to work at Acme?": "Because of the mission.",
    });
    expect(plan.open.map((o) => o.label)).toEqual(["What's your favourite product and why?"]);
    expect(plan.skipped.map((s) => s.label)).toEqual(["Gender"]);
  });
  it("skips the resume upload when there's no resume", () => {
    const plan = planFill([field("Resume", { kind: "file" })], { ...data, hasResume: false });
    expect(plan.actions).toEqual([]);
    expect(plan.skipped[0].reason).toMatch(/Upload a resume/);
  });
});
