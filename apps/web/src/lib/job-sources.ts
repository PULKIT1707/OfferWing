import { roleWords } from "@/lib/agents/referral-scout";
import { decodeEntities, stripTags } from "@/lib/job-alerts";

// Public career-board feeds (no auth needed): Greenhouse, Lever, Ashby.

export type SourceKind = "greenhouse" | "lever" | "ashby";
export type Posting = { externalId: string; title: string; location: string | null; url: string; description: string | null };
export type Board = { companyName: string | null; postings: Posting[] };

const TOKEN = /^[A-Za-z0-9._-]{1,100}$/;

// "https://boards.greenhouse.io/stripe", "https://jobs.lever.co/figma", "https://jobs.ashbyhq.com/linear" → kind + token.
export function parseCareersUrl(input: string): { kind: SourceKind; token: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);
  let kind: SourceKind | null = null;
  let token: string | undefined;
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    kind = "greenhouse";
    token = host.startsWith("boards-api.") ? segments[2] : segments[0] === "embed" ? u.searchParams.get("for") ?? undefined : segments[0];
  } else if (host === "jobs.lever.co" || host === "api.lever.co") {
    kind = "lever";
    token = host === "api.lever.co" ? segments[2] : segments[0];
  } else if (host === "jobs.ashbyhq.com") {
    kind = "ashby";
    token = segments[0];
  }
  return kind && token && TOKEN.test(token) ? { kind, token: decodeURIComponent(token) } : null;
}

const clip = (s: string | null | undefined) => (s ? s.slice(0, 30000) : null);

type GreenhouseJob = { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string };
export function mapGreenhouse(token: string, json: { jobs?: GreenhouseJob[] }): Posting[] {
  return (json.jobs ?? []).map((j) => ({
    externalId: `greenhouse:${token}:${j.id}`,
    title: j.title,
    location: j.location?.name ?? null,
    url: j.absolute_url,
    // Greenhouse returns HTML-escaped HTML.
    description: clip(j.content ? stripTags(decodeEntities(j.content)) : null),
  }));
}

type LeverJob = { id: string; text: string; hostedUrl: string; categories?: { location?: string }; descriptionPlain?: string; lists?: { text: string; content: string }[]; additionalPlain?: string };
export function mapLever(token: string, json: LeverJob[]): Posting[] {
  return (Array.isArray(json) ? json : []).map((j) => ({
    externalId: `lever:${token}:${j.id}`,
    title: j.text,
    location: j.categories?.location ?? null,
    url: j.hostedUrl,
    description: clip(
      [j.descriptionPlain, ...(j.lists ?? []).map((l) => `${l.text}\n${stripTags(l.content)}`), j.additionalPlain].filter(Boolean).join("\n\n") || null,
    ),
  }));
}

type AshbyJob = { id: string; title: string; jobUrl: string; location?: string; descriptionPlain?: string; isListed?: boolean };
export function mapAshby(token: string, json: { jobs?: AshbyJob[] }): Posting[] {
  return (json.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({ externalId: `ashby:${token}:${j.id}`, title: j.title, location: j.location ?? null, url: j.jobUrl, description: clip(j.descriptionPlain) }));
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Offerwing job discovery" }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) throw new Error("That careers board wasn't found. Check the link.");
  if (!res.ok) throw new Error(`The careers board responded with an error (${res.status}).`);
  return res.json();
}

export async function fetchBoard(kind: SourceKind, token: string): Promise<Board> {
  const t = encodeURIComponent(token);
  if (kind === "greenhouse") {
    const [board, jobs] = await Promise.all([
      getJson(`https://boards-api.greenhouse.io/v1/boards/${t}`).catch(() => null) as Promise<{ name?: string } | null>,
      getJson(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`) as Promise<{ jobs?: GreenhouseJob[] }>,
    ]);
    return { companyName: board?.name ?? null, postings: mapGreenhouse(token, jobs) };
  }
  if (kind === "lever") return { companyName: null, postings: mapLever(token, (await getJson(`https://api.lever.co/v0/postings/${t}?mode=json`)) as LeverJob[]) };
  const json = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${t}`)) as { jobs?: AshbyJob[]; organizationName?: string };
  return { companyName: json.organizationName ?? null, postings: mapAshby(token, json) };
}

// A posting matches when its title's head noun equals a target role's head noun: "Staff Product Designer" or
// "Designer, Web Presence" match "Senior Product Designer", but "Design Program Manager" doesn't.
// The head noun is the last word of the title's main part (before any comma, dash or parenthesis).
export function matchesTargetRoles(title: string, targetRoles: string[]): boolean {
  if (!targetRoles.length) return true;
  const main = title.split(/\s[-–—|]\s|[,(:]/)[0];
  const titleHead = roleWords(main).at(-1);
  return !!titleHead && targetRoles.some((role) => roleWords(role).at(-1) === titleHead);
}

// Readable company name from a board token ("acme-corp" → "Acme Corp").
export const nameFromToken = (token: string) => token.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
