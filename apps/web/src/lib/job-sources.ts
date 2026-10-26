import { roleWords } from "@/lib/agents/referral-scout";
import { decodeEntities, stripTags } from "@/lib/job-alerts";
import { SOURCE_KINDS, SOURCE_LABEL, type SourceKind } from "@/lib/source-kinds";

// Public career-board feeds (no auth needed). Each source is one entry in PROVIDERS: how to
// recognize its careers links, and how to read a board. Adding a source means adding an entry
// (and its kind to the job_sources check constraint), nothing else.

export { SOURCE_KINDS, SOURCE_LABEL, type SourceKind };
export type Posting = { externalId: string; title: string; location: string | null; url: string; description: string | null };
export type Board = { companyName: string | null; postings: Posting[] };

type Provider = {
  label: string;
  // Board token from a parsed careers URL, or undefined when the URL isn't this source's.
  token: (u: URL, host: string, segments: string[]) => string | undefined;
  fetch: (token: string) => Promise<Board>;
  // Optional per-posting enrichment, for sources whose board listing has no description.
  details?: (token: string, posting: Posting) => Promise<string | null>;
};

const TOKEN = /^[A-Za-z0-9._-]{1,100}$/;
// Tokens that become part of a hostname ({token}.recruitee.com) can't contain dots.
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "apply", "jobs", "careers", "help", "support", "blog"]);

const clip = (s: string | null | undefined) => (s ? s.slice(0, 30000) : null);
const htmlText = (html: string | null | undefined) => (html ? stripTags(decodeEntities(html)) : "");
const MAX_BODY_BYTES = 15 * 1024 * 1024;

// Every request goes through here: HTTPS only, the host must be one the provider declared, no
// redirects (a redirect could point anywhere), a timeout and a size cap.
async function getJson(url: string, allowedHost: (host: string) => boolean): Promise<unknown> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !allowedHost(u.hostname.toLowerCase())) throw new Error("That careers board address isn't allowed.");
  const res = await fetch(u, {
    headers: { Accept: "application/json", "User-Agent": "Offerwing job discovery" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) throw new Error("That careers board wasn't found. Check the link.");
  if (!res.ok) throw new Error(`The careers board responded with an error (${res.status}).`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new Error("That careers board is too large to read.");
  const text = await res.text();
  if (text.length > MAX_BODY_BYTES) throw new Error("That careers board is too large to read.");
  return JSON.parse(text);
}

const exactHost = (...hosts: string[]) => (h: string) => hosts.includes(h);

// ---- Greenhouse ----
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

// ---- Lever ----
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

// ---- Ashby ----
type AshbyJob = { id: string; title: string; jobUrl: string; location?: string; descriptionPlain?: string; isListed?: boolean };
export function mapAshby(token: string, json: { jobs?: AshbyJob[] }): Posting[] {
  return (json.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({ externalId: `ashby:${token}:${j.id}`, title: j.title, location: j.location ?? null, url: j.jobUrl, description: clip(j.descriptionPlain) }));
}

// ---- SmartRecruiters ----
type SmartRecruitersPosting = { id: string; name: string; location?: { city?: string; region?: string; country?: string; remote?: boolean }; company?: { name?: string } };
export function mapSmartRecruiters(token: string, json: { content?: SmartRecruitersPosting[] }): Posting[] {
  return (json.content ?? []).map((j) => {
    const place = [j.location?.city, j.location?.region, j.location?.country?.toUpperCase()].filter(Boolean).join(", ");
    return {
      externalId: `smartrecruiters:${token}:${j.id}`,
      title: j.name.trim(),
      location: j.location?.remote ? (place ? `Remote · ${place}` : "Remote") : place || null,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(token)}/${encodeURIComponent(j.id)}`,
      // The listing has no description; details() reads it per posting.
      description: null,
    };
  });
}
type SmartRecruitersDetail = { jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> } };
export function smartRecruitersDescription(json: SmartRecruitersDetail): string | null {
  const s = json.jobAd?.sections ?? {};
  const parts = ["jobDescription", "qualifications", "additionalInformation"]
    .map((k) => s[k])
    .filter((p): p is { title?: string; text?: string } => !!p?.text)
    .map((p) => `${p.title ? `${p.title}\n` : ""}${htmlText(p.text)}`);
  return clip(parts.join("\n\n") || null);
}

// ---- Workable ----
type WorkableJob = { title: string; shortcode: string; url?: string; shortlink?: string; city?: string; state?: string; country?: string; telecommuting?: boolean; description?: string };
export function mapWorkable(token: string, json: { jobs?: WorkableJob[] }): Posting[] {
  return (json.jobs ?? []).map((j) => {
    const place = [j.city, j.state, j.country].filter(Boolean).join(", ");
    return {
      externalId: `workable:${token}:${j.shortcode}`,
      title: j.title.trim(),
      location: j.telecommuting ? (place ? `Remote · ${place}` : "Remote") : place || null,
      url: j.url || j.shortlink || `https://apply.workable.com/${encodeURIComponent(token)}/j/${encodeURIComponent(j.shortcode)}/`,
      description: clip(htmlText(j.description) || null),
    };
  });
}

// ---- Recruitee ----
type RecruiteeOffer = { id: number; title: string; careers_url: string; location?: string; remote?: boolean; description?: string; requirements?: string; status?: string };
export function mapRecruitee(token: string, json: { offers?: RecruiteeOffer[] }): Posting[] {
  return (json.offers ?? [])
    .filter((o) => !o.status || o.status === "published")
    .map((o) => ({
      externalId: `recruitee:${token}:${o.id}`,
      title: o.title.trim(),
      location: o.remote ? (o.location ? `Remote · ${o.location}` : "Remote") : o.location || null,
      url: o.careers_url,
      description: clip([htmlText(o.description), htmlText(o.requirements)].filter(Boolean).join("\n\n") || null),
    }));
}

const SMARTRECRUITERS_PAGE = 100;
const SMARTRECRUITERS_MAX_PAGES = 10;

export const PROVIDERS: Record<SourceKind, Provider> = {
  greenhouse: {
    label: "Greenhouse",
    token: (u, host, seg) =>
      /(^|\.)greenhouse\.io$/.test(host) ? (host.startsWith("boards-api.") ? seg[2] : seg[0] === "embed" ? u.searchParams.get("for") ?? undefined : seg[0]) : undefined,
    fetch: async (token) => {
      const t = encodeURIComponent(token);
      const allowed = exactHost("boards-api.greenhouse.io");
      const [board, jobs] = await Promise.all([
        getJson(`https://boards-api.greenhouse.io/v1/boards/${t}`, allowed).catch(() => null) as Promise<{ name?: string } | null>,
        getJson(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`, allowed) as Promise<{ jobs?: GreenhouseJob[] }>,
      ]);
      return { companyName: board?.name ?? null, postings: mapGreenhouse(token, jobs) };
    },
  },
  lever: {
    label: "Lever",
    token: (_u, host, seg) => (host === "jobs.lever.co" ? seg[0] : host === "api.lever.co" ? seg[2] : undefined),
    fetch: async (token) => ({
      companyName: null,
      postings: mapLever(token, (await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`, exactHost("api.lever.co"))) as LeverJob[]),
    }),
  },
  ashby: {
    label: "Ashby",
    token: (_u, host, seg) => (host === "jobs.ashbyhq.com" ? seg[0] : undefined),
    fetch: async (token) => {
      const json = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`, exactHost("api.ashbyhq.com"))) as { jobs?: AshbyJob[]; organizationName?: string };
      return { companyName: json.organizationName ?? null, postings: mapAshby(token, json) };
    },
  },
  smartrecruiters: {
    label: "SmartRecruiters",
    token: (_u, host, seg) =>
      host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com"
        ? seg[0]
        : host === "api.smartrecruiters.com" && seg[1] === "companies"
          ? seg[2]
          : undefined,
    fetch: async (token) => {
      const t = encodeURIComponent(token);
      const postings: Posting[] = [];
      let companyName: string | null = null;
      for (let page = 0; page < SMARTRECRUITERS_MAX_PAGES; page++) {
        const json = (await getJson(
          `https://api.smartrecruiters.com/v1/companies/${t}/postings?limit=${SMARTRECRUITERS_PAGE}&offset=${page * SMARTRECRUITERS_PAGE}`,
          exactHost("api.smartrecruiters.com"),
        )) as { content?: SmartRecruitersPosting[]; totalFound?: number };
        companyName ??= json.content?.[0]?.company?.name ?? null;
        postings.push(...mapSmartRecruiters(token, json));
        if (!json.content?.length || postings.length >= (json.totalFound ?? 0)) break;
      }
      return { companyName, postings };
    },
    details: async (token, posting) => {
      const id = posting.externalId.split(":").at(-1)!;
      const json = (await getJson(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings/${encodeURIComponent(id)}`,
        exactHost("api.smartrecruiters.com"),
      )) as SmartRecruitersDetail;
      return smartRecruitersDescription(json);
    },
  },
  workable: {
    label: "Workable",
    token: (_u, host, seg) => {
      if (host === "apply.workable.com") return seg[0] === "api" ? (seg[3] === "accounts" ? seg[4] : undefined) : seg[0] === "j" ? undefined : seg[0];
      const sub = host.match(/^([a-z0-9-]+)\.workable\.com$/)?.[1];
      return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : undefined;
    },
    fetch: async (token) => {
      const json = (await getJson(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`, exactHost("apply.workable.com"))) as {
        name?: string;
        jobs?: WorkableJob[];
      };
      return { companyName: json.name ?? null, postings: mapWorkable(token, json) };
    },
  },
  recruitee: {
    label: "Recruitee",
    token: (_u, host) => {
      const sub = host.match(/^([a-z0-9-]+)\.recruitee\.com$/)?.[1];
      return sub && !RESERVED_SUBDOMAINS.has(sub) ? sub : undefined;
    },
    fetch: async (token) => {
      if (!SUBDOMAIN.test(token)) throw new Error("That Recruitee link isn't valid.");
      const host = `${token.toLowerCase()}.recruitee.com`;
      const json = (await getJson(`https://${host}/api/offers/`, exactHost(host))) as { offers?: (RecruiteeOffer & { company_name?: string })[] };
      return { companyName: json.offers?.[0]?.company_name ?? null, postings: mapRecruitee(token, json) };
    },
  },
};

// "https://boards.greenhouse.io/stripe", "https://jobs.lever.co/figma", "https://jobs.ashbyhq.com/linear",
// "https://jobs.smartrecruiters.com/Bosch", "https://apply.workable.com/acme", "https://acme.recruitee.com" → kind + token.
export function parseCareersUrl(input: string): { kind: SourceKind; token: string } | null {
  let u: URL;
  try {
    u = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);
  for (const kind of SOURCE_KINDS) {
    const token = PROVIDERS[kind].token(u, host, segments);
    if (token !== undefined) return token && TOKEN.test(token) ? { kind, token: decodeURIComponent(token) } : null;
  }
  return null;
}

export const fetchBoard = (kind: SourceKind, token: string): Promise<Board> => PROVIDERS[kind].fetch(token);

// Fills in descriptions for postings whose board listing has none (SmartRecruiters), at most `limit`
// per call so a large board can't turn one poll into hundreds of requests.
export async function withDetails(kind: SourceKind, token: string, postings: Posting[], limit = 25): Promise<Posting[]> {
  const details = PROVIDERS[kind].details;
  if (!details) return postings;
  let budget = limit;
  return Promise.all(
    postings.map(async (p) => {
      if (p.description || budget <= 0) return p;
      budget--;
      return { ...p, description: await details(token, p).catch(() => null) };
    }),
  );
}

// Lower-cased words a title must not contain for the user ("intern", "contract", "sales").
export const titleExcluded = (title: string, exclude: string[]) => {
  const words = ` ${title.toLowerCase().replace(/[^a-z0-9+#]+/g, " ")} `;
  return exclude.some((x) => {
    const w = x.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
    return w && words.includes(` ${w} `);
  });
};

// A posting matches when its title's head noun equals a target role's head noun: "Staff Product Designer" or
// "Designer, Web Presence" match "Senior Product Designer", but "Design Program Manager" doesn't.
// The head noun is the last word of the title's main part (before any comma, dash or parenthesis).
// Titles containing any of the user's excluded words never match ("Interior Designer" with "interior").
export function matchesTargetRoles(title: string, targetRoles: string[], exclude: string[] = []): boolean {
  if (titleExcluded(title, exclude)) return false;
  if (!targetRoles.length) return true;
  const main = title.split(/\s[-–—|]\s|[,(:]/)[0];
  const titleHead = roleWords(main).at(-1);
  return !!titleHead && targetRoles.some((role) => roleWords(role).at(-1) === titleHead);
}

// Readable company name from a board token ("acme-corp" → "Acme Corp").
export const nameFromToken = (token: string) => token.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Tracking parameters that make the same posting look like a different URL.
const TRACKING = /^(?:utm_.+|gh_src|gh_jid_src|lever-source|lever-origin|source|ref|referrer|trk|trackingid|src|ashby_jid_src|oga)$/i;

// One key per posting URL: tracking params dropped, host lower-cased, no trailing slash or fragment.
export function normalizeJobUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/\.$/, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return url.trim();
  }
}
