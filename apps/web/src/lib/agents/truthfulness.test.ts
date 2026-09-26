import { describe, expect, it } from "vitest";
import type { ApplicationKit } from "./application-tailor";
import { verifyKit } from "./truthfulness";

const source = `Alex Morgan
Northwind Labs
Product Designer
Ran user interviews with 40 customers. Helped build the design system.
Contoso Health
UX Designer
Redesigned the patient onboarding flow, cutting drop-off by 1,200 users a month.
Top Skills: Figma, User Research, Prototyping`;

function kit(overrides: Partial<ApplicationKit["resume"]> = {}, extra: Partial<ApplicationKit> = {}): ApplicationKit {
  return {
    resume: { name: "Alex", headline: "", contact_line: "", summary: "Product designer.", experience: [], skills: [], education: [], extra_sections: [], ...overrides },
    cover_note: "Hello.",
    connection_note: "Hi!",
    screening_answers: [],
    changes_made: [],
    needs_input: [],
    ...extra,
  };
}

describe("verifyKit", () => {
  it("passes content that traces back to the documents", () => {
    const v = verifyKit(
      kit({
        experience: [
          {
            title: "Product Designer",
            company: "Northwind Labs",
            location: "",
            dates: "",
            bullets: [
              { text: "Interviewed 40 customers to shape the roadmap", evidence: "Ran user interviews with 40 customers" },
              { text: "Built the design system, cutting build time [X%]", evidence: "Helped build the design system" },
            ],
          },
          { title: "UX Designer", company: "Contoso Health", location: "", dates: "", bullets: [{ text: "Cut drop-off by 1200 users a month", evidence: "cutting drop-off by 1,200 users a month" }] },
        ],
        skills: ["Figma", "Design Systems"],
      }),
      source,
    );
    expect(v.flagged).toEqual([]);
    expect(v.unverified_skills).toEqual([]);
  });

  it("flags invented bullets, numbers, titles, companies and skills", () => {
    const v = verifyKit(
      kit(
        {
          summary: "Designer with 8 years of experience.",
          experience: [
            { title: "Lead UX Designer", company: "Contoso Health", location: "", dates: "", bullets: [] },
            { title: "Designer", company: "Globex Corp", location: "", dates: "", bullets: [{ text: "Grew revenue 25%", evidence: "Grew revenue 25%" }] },
          ],
          skills: ["Kubernetes"],
        },
        { cover_note: "I led a team of 12 designers." },
      ),
      source,
    );
    const reasons = v.flagged.flatMap((f) => f.reasons).join(" | ");
    expect(reasons).toContain("Job title doesn't match");
    expect(reasons).toContain("Company name not found");
    expect(reasons).toContain("Supporting quote not found");
    expect(reasons).toContain("Number not in your documents: 25");
    expect(reasons).toContain("Number not in your documents: 8");
    expect(reasons).toContain("Number not in your documents: 12");
    expect(v.unverified_skills).toEqual(["Kubernetes"]);
  });
});
