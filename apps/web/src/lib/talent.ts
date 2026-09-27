// Pure helpers for the opt-in talent marketplace: keep anonymous profiles anonymous.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b(linkedin|github)\.com\/\S+/gi;

// Words from the candidate's name and past employers/schools that must not appear in the
// anonymous profile. Short or generic words are skipped to avoid false hits.
export type IdentityTerms = { names: string[]; orgs: string[] };
const longestFirst = (a: string, b: string) => b.length - a.length;

export function identityTerms(opts: { fullName: string | null; employers: string[] }): IdentityTerms {
  const GENERIC = new Set(["inc", "llc", "ltd", "the", "and", "group", "labs", "company", "corp", "university", "college", "school", "institute", "technologies", "technology", "global", "systems", "solutions", "services"]);
  const nameParts = (opts.fullName ?? "").split(/\s+/).filter((w) => w.length >= 3);
  const employers = opts.employers
    .map((e) => e.trim())
    .filter((e) => e.length >= 2)
    .flatMap((e) => [e, ...e.split(/[\s,&]+/).filter((w) => w.length >= 4 && !GENERIC.has(w.toLowerCase()))]);
  return { names: [...new Set(nameParts)].sort(longestFirst), orgs: [...new Set(employers)].sort(longestFirst) };
}

export const allTerms = (t: IdentityTerms) => [...t.names, ...t.orgs].sort(longestFirst);

export function findIdentifying(text: string, terms: string[]): string[] {
  const found = terms.filter((t) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(t)}($|[^\\p{L}\\p{N}])`, "iu").test(text));
  if (EMAIL.test(text)) found.push("an email address");
  if (PHONE.test(text)) found.push("a phone number");
  if (URL_RE.test(text)) found.push("a link");
  EMAIL.lastIndex = PHONE.lastIndex = URL_RE.lastIndex = 0;
  return found;
}

// Replaces identifying terms with neutral wording. Longer terms first so "Acme Robotics" wins over "Acme".
export function scrubIdentity(text: string, terms: IdentityTerms): string {
  let out = text.replace(EMAIL, "[email]").replace(URL_RE, "[link]").replace(PHONE, "[phone]");
  const replace = (t: string, with_: string) => {
    out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escape(t)}(?=$|[^\\p{L}\\p{N}])`, "giu"), `$1${with_}`);
  };
  for (const t of terms.orgs) replace(t, "a previous employer");
  for (const t of terms.names) replace(t, "the candidate");
  // "at a previous employer's" / doubled replacements read badly; tidy the common cases.
  return out.replace(/(a previous employer)(\s+a previous employer)+/g, "$1").replace(/(the candidate)(\s+the candidate)+/g, "$1").replace(/\s{2,}/g, " ").trim();
}

export const AVAILABILITY = [
  ["now", "Available now"],
  ["2_weeks", "2 weeks' notice"],
  ["1_month", "1 month's notice"],
  ["3_months", "3 months' notice"],
  ["exploring", "Open to the right role"],
] as const;
export type Availability = (typeof AVAILABILITY)[number][0];
