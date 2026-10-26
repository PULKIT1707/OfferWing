import { describe, expect, it } from "vitest";
import { checkPostingLive, checkPostingsLive, detectDealbreakers, parsePostingUrl } from "./job-gates";

const sponsor = { needs_sponsorship: true, work_modes: ["remote", "hybrid"] };
const remoteOnly = { needs_sponsorship: false, work_modes: ["remote"] };

describe("detectDealbreakers", () => {
  it.each([
    "We are unable to sponsor visas for this role.",
    "We do not offer visa sponsorship.",
    "Applicants must be authorized to work in the US without sponsorship.",
    "Visa sponsorship is not available.",
    "No sponsorship.",
    "Candidates must be able to work without the need for current or future visa sponsorship.",
  ])("flags a no-sponsorship statement: %s", (text) => {
    expect(detectDealbreakers(text, sponsor)).toHaveLength(1);
  });

  it.each([
    "We sponsor visas for strong candidates.",
    "Candidates who do not require sponsorship are welcome, and we can sponsor too.",
    "Sponsorship is available.",
  ])("doesn't flag sponsorship-friendly text: %s", (text) => {
    expect(detectDealbreakers(text, sponsor)).toEqual([]);
  });

  it("only checks sponsorship when the candidate needs it", () => {
    expect(detectDealbreakers("We do not offer visa sponsorship.", remoteOnly)).toEqual([]);
  });

  it.each(["This role is not remote.", "On-site only in Austin.", "Fully in-office, Monday to Friday.", "In-office 5 days a week."])(
    "flags a not-remote statement for remote-only candidates: %s",
    (text) => {
      expect(detectDealbreakers(text, remoteOnly)).toHaveLength(1);
    },
  );

  it("doesn't flag work mode for candidates open to hybrid or on-site", () => {
    expect(detectDealbreakers("This role is not remote.", { needs_sponsorship: false, work_modes: ["remote", "hybrid"] })).toEqual([]);
  });

  it("doesn't flag remote postings", () => {
    expect(detectDealbreakers("Fully remote across the US. Occasional on-site offsites.", remoteOnly)).toEqual([]);
  });
});

describe("parsePostingUrl", () => {
  it("recognizes single postings on the three ATSes", () => {
    expect(parsePostingUrl("https://job-boards.greenhouse.io/stripe/jobs/6012345")).toEqual({ kind: "greenhouse", board: "stripe", id: "6012345" });
    expect(parsePostingUrl("https://boards.greenhouse.io/stripe/jobs/6012345?gh_src=x")).toEqual({ kind: "greenhouse", board: "stripe", id: "6012345" });
    expect(parsePostingUrl("https://jobs.lever.co/figma/0b4c1f7e-1111-4aaa-9bbb-123456789abc/apply")).toEqual({
      kind: "lever",
      board: "figma",
      id: "0b4c1f7e-1111-4aaa-9bbb-123456789abc",
    });
    expect(parsePostingUrl("https://jobs.ashbyhq.com/linear/0B4C1F7E-1111-4AAA-9BBB-123456789ABC")).toEqual({
      kind: "ashby",
      board: "linear",
      id: "0b4c1f7e-1111-4aaa-9bbb-123456789abc",
    });
  });

  it("ignores boards, other hosts and look-alike URLs", () => {
    expect(parsePostingUrl("https://job-boards.greenhouse.io/stripe")).toBeNull();
    expect(parsePostingUrl("https://example.com/?next=https://jobs.lever.co/figma/0b4c1f7e-1111-4aaa-9bbb-123456789abc")).toBeNull();
    expect(parsePostingUrl("https://jobs.lever.co.evil.com/figma/0b4c1f7e-1111-4aaa-9bbb-123456789abc")).toBeNull();
    expect(parsePostingUrl("not a url")).toBeNull();
    expect(parsePostingUrl(null)).toBeNull();
  });
});

const respond = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status });

describe("checkPostingLive", () => {
  const gh = "https://job-boards.greenhouse.io/stripe/jobs/1";
  const ashby = "https://jobs.ashbyhq.com/linear/0b4c1f7e-1111-4aaa-9bbb-123456789abc";

  it("is closed only on an explicit 404", async () => {
    expect(await checkPostingLive(gh, respond(404))).toBe("closed");
    expect(await checkPostingLive(gh, respond(200))).toBe("live");
    expect(await checkPostingLive(gh, respond(500))).toBe("unknown");
    expect(await checkPostingLive(gh, async () => { throw new Error("timeout"); })).toBe("unknown");
  });

  it("checks Ashby postings against the board listing", async () => {
    expect(await checkPostingLive(ashby, respond(200, { jobs: [{ id: "0b4c1f7e-1111-4aaa-9bbb-123456789abc" }] }))).toBe("live");
    expect(await checkPostingLive(ashby, respond(200, { jobs: [{ id: "other" }] }))).toBe("closed");
    expect(await checkPostingLive(ashby, respond(200, { jobs: [{ id: "0b4c1f7e-1111-4aaa-9bbb-123456789abc", isListed: false }] }))).toBe("closed");
    expect(await checkPostingLive(ashby, respond(200, {}))).toBe("unknown");
    expect(await checkPostingLive(ashby, respond(404))).toBe("unknown");
  });

  it("calls the ATS API, never the URL the user saved", async () => {
    const seen: string[] = [];
    await checkPostingLive(gh, async (url) => {
      seen.push(url);
      return new Response("{}", { status: 200 });
    });
    expect(seen).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs/1"]);
  });

  it("returns unknown for URLs it doesn't recognize, without fetching", async () => {
    let calls = 0;
    const out = await checkPostingsLive(["https://example.com/job/1", null], async () => {
      calls++;
      return new Response("{}");
    });
    expect(out).toEqual(["unknown", "unknown"]);
    expect(calls).toBe(0);
  });
});
