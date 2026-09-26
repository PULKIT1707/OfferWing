import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ownCompanyKeysFrom, roleTermsFrom, scoreConnection } from "./agents/referral-scout";
import { parseLinkedInExport } from "./linkedin-export";

// Fictional people, in LinkedIn's export format (including the "Notes:" preamble).
const connections = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Priya,Shah,https://www.linkedin.com/in/priya-shah-test,,"Stripe, Inc.",Design Lead,12 Mar 2019
Marco,Tanaka,https://www.linkedin.com/in/marco-tanaka-test,marco@example.com,Stripe,Technical Recruiter,03 Jan 2025
Priya,Shah,https://www.linkedin.com/in/priya-shah-test,,"Stripe, Inc.",Design Lead,12 Mar 2019
`;
const messages = [
  "CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER",
  ...Array.from({ length: 24 }, () => `c1,,Me,https://www.linkedin.com/in/me-test,Priya Shah,https://www.linkedin.com/in/priya-shah-test/,${new Date().getFullYear()}-01-10 10:00:00 UTC,,"hi, there",INBOX`),
].join("\n");
const positions = "Company Name,Title,Description,Location,Started On,Finished On\nNorthwind Labs,Product Designer,,,Mar 2022,\n";

const zip = () =>
  zipSync({
    "Basic_LinkedInDataExport/Connections.csv": strToU8(connections),
    "Basic_LinkedInDataExport/messages.csv": strToU8(messages),
    "Basic_LinkedInDataExport/Positions.csv": strToU8(positions),
  });

describe("parseLinkedInExport", () => {
  it("parses connections, dedupes, counts messages and drops emails", () => {
    const parsed = parseLinkedInExport(zip());
    expect(parsed.connections).toHaveLength(2);
    const priya = parsed.connections.find((c) => c.full_name === "Priya Shah")!;
    expect(priya.company_key).toBe("stripe");
    expect(priya.message_count).toBe(24);
    expect(priya.connected_on).toBe("2019-03-12");
    expect(parsed.connections.some((c) => "email" in c)).toBe(false);
    expect(parsed.ownCompanies).toEqual(["Northwind Labs"]);
  });
  it("rejects files that aren't a LinkedIn export", () => {
    expect(() => parseLinkedInExport(new Uint8Array([1, 2, 3]))).toThrow("NOT_A_ZIP");
    expect(() => parseLinkedInExport(zipSync({ "x.txt": strToU8("hi") }))).toThrow("NO_CONNECTIONS");
  });
});

describe("scoreConnection", () => {
  it("ranks close, relevant people higher and explains why", () => {
    const parsed = parseLinkedInExport(zip());
    const ctx = { roleTerms: roleTermsFrom("Senior Product Designer"), ownCompanyKeys: ownCompanyKeysFrom(parsed.ownCompanies) };
    const [priya, marco] = ["Priya Shah", "Marco Tanaka"].map((n) => scoreConnection({ ...parsed.connections.find((c) => c.full_name === n)!, id: n }, ctx));
    expect(priya.score).toBeGreaterThan(marco.score);
    expect(priya.reasons).toContain("Works in your field");
    expect(marco.reasons).toContain("Recruiter");
  });
  it("matches role words across forms", () => {
    const base = { id: "x", full_name: "T", profile_url: null, company: null, company_key: null, connected_on: null, message_count: 0, last_message_at: null };
    const field = (target: string, position: string) => scoreConnection({ ...base, position }, { roleTerms: roleTermsFrom(target), ownCompanyKeys: new Set() }).reasons.includes("Works in your field");
    expect(field("Software Engineer", "Engineering Manager")).toBe(true);
    expect(field("Data Scientist", "Product Designer")).toBe(false);
  });
});
