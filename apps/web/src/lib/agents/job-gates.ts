// Checks that run before a job is scored, in code rather than in the model: they're free, they
// give the same answer every time, and a dead or ruled-out posting shouldn't cost an AI run.

export type GatePrefs = { needs_sponsorship: boolean; work_modes: string[] };

const NO_SPONSORSHIP = [
  /\b(?:unable|not able|cannot|can't|can ?not|won't|will not|do not|don't|does not|doesn't|is not able)\s+(?:to\s+)?(?:provide|offer|support)?\s*(?:visa\s+|immigration\s+|work\s+)?sponsor(?:ship)?/i,
  /\bno\s+(?:visa\s+|immigration\s+)?sponsorship\b/i,
  /\bwithout\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+|any\s+)?(?:visa\s+|employer\s+|immigration\s+)?sponsorship\b/i,
  /\bsponsorship\s+(?:is\s+)?(?:not|unavailable|isn't)\s*(?:available|offered|provided|possible)?\b/i,
];

const NOT_REMOTE = [
  /\b(?:this|the)\s+(?:role|position|job)\s+is\s+not\s+(?:a\s+)?remote\b/i,
  /\bnot\s+a\s+remote\s+(?:role|position|job)\b/i,
  /\bno\s+remote\s+(?:work|option)/i,
  /\b(?:on-?site|in-?office)\s+only\b/i,
  /\b(?:100%|fully)\s+(?:on-?site|in[- ]office)\b/i,
  /\bin[- ]office\s+(?:5|five)\s+days\b/i,
];

// Conflicts between the posting's own words and the candidate's hard preferences. Conservative on
// purpose: each pattern is an explicit statement, so a match is a real conflict, not a guess.
export function detectDealbreakers(description: string, prefs: GatePrefs): string[] {
  const text = description.replace(/\s+/g, " ");
  const found: string[] = [];
  if (prefs.needs_sponsorship && NO_SPONSORSHIP.some((re) => re.test(text))) {
    found.push("You need visa sponsorship, and the posting says it doesn't sponsor.");
  }
  const remoteOnly = prefs.work_modes.length > 0 && prefs.work_modes.every((m) => m === "remote");
  if (remoteOnly && NOT_REMOTE.some((re) => re.test(text))) {
    found.push("You only want remote roles, and the posting says this one isn't remote.");
  }
  return found;
}

export type Liveness = "live" | "closed" | "unknown";
type PostingRef = { kind: "greenhouse" | "lever" | "ashby"; board: string; id: string };

const SLUG = /^[A-Za-z0-9._-]{1,100}$/;

// Recognizes a single posting on Greenhouse, Lever or Ashby from its public URL. Hosts are matched
// exactly on the parsed URL, never by searching the raw string.
export function parsePostingUrl(input: string | null | undefined): PostingRef | null {
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);
  let ref: PostingRef | null = null;
  if (["boards.greenhouse.io", "job-boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.eu.greenhouse.io"].includes(host) && seg[1] === "jobs" && /^\d+$/.test(seg[2] ?? "")) {
    ref = { kind: "greenhouse", board: seg[0], id: seg[2] };
  } else if (host === "jobs.lever.co" && seg.length >= 2 && /^[0-9a-f-]{36}$/i.test(seg[1])) {
    ref = { kind: "lever", board: seg[0], id: seg[1] };
  } else if (host === "jobs.ashbyhq.com" && seg.length >= 2 && /^[0-9a-f-]{36}$/i.test(seg[1])) {
    ref = { kind: "ashby", board: seg[0], id: seg[1].toLowerCase() };
  }
  return ref && SLUG.test(ref.board) ? ref : null;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

// Asks the ATS's public API whether the posting still exists. "closed" only on an explicit answer
// (a 404 for the posting, or a board that lists jobs without it); anything else is "unknown", so a
// slow or unfamiliar board never blocks scoring.
export async function checkPostingLive(url: string | null | undefined, fetchImpl: Fetch = fetch, timeoutMs = 6000): Promise<Liveness> {
  const ref = parsePostingUrl(url);
  if (!ref) return "unknown";
  const board = encodeURIComponent(ref.board);
  const init: RequestInit = { headers: { Accept: "application/json", "User-Agent": "Offerwing posting check" }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) };
  try {
    if (ref.kind === "greenhouse" || ref.kind === "lever") {
      const api =
        ref.kind === "greenhouse"
          ? `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${ref.id}`
          : `https://api.lever.co/v0/postings/${board}/${ref.id}`;
      const res = await fetchImpl(api, init);
      if (res.status === 404) return "closed";
      return res.ok ? "live" : "unknown";
    }
    const res = await fetchImpl(`https://api.ashbyhq.com/posting-api/job-board/${board}`, init);
    if (!res.ok) return "unknown";
    const json = (await res.json()) as { jobs?: { id?: string; isListed?: boolean }[] };
    if (!Array.isArray(json.jobs)) return "unknown";
    const job = json.jobs.find((j) => j.id?.toLowerCase() === ref.id);
    return job && job.isListed !== false ? "live" : "closed";
  } catch {
    return "unknown";
  }
}

// Runs checkPostingLive over many URLs with a small concurrency limit.
export async function checkPostingsLive(urls: (string | null)[], fetchImpl: Fetch = fetch, concurrency = 5): Promise<Liveness[]> {
  const out: Liveness[] = urls.map(() => "unknown");
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < urls.length; i = next++) out[i] = await checkPostingLive(urls[i], fetchImpl);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
