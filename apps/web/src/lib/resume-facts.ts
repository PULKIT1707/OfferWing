// Facts we can read from resume / LinkedIn-PDF text without AI: contact details, links and
// years of experience. Used to prefill onboarding and Settings → Applications. Pure (no I/O).

export type ResumeFacts = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  yearsExperience: number | null;
};

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
// International or local numbers with at least 9 digits; dates and year ranges don't qualify.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{2,5}(?:[\s.-]?\d{2,5}){2,4}/g;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i;
const GITHUB = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9-]+(?![\w/-]*\/[\w-]+\/)/i;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|me|co|design|net|org|app|ai|xyz|site|page)(?:\/[^\s)]*)?/gi;

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/\/$/, "");

function phoneIn(text: string): string | null {
  for (const m of text.matchAll(PHONE)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) continue;
    // Skip year ranges like "2019 - 2023 2024".
    if (/^(19|20)\d{2}([\s.-]+(19|20)\d{2})+$/.test(raw)) continue;
    return raw;
  }
  return null;
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";
const RANGE = new RegExp(
  String.raw`(?:(?:${MONTHS})\.?\s+)?((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:(?:(?:${MONTHS})\.?\s+)?((?:19|20)\d{2})|(present|current|now|today))`,
  "gi",
);

// Drops Education sections (degrees aren't work experience) up to the next section heading.
const SECTION = /^\s*(experience|work experience|professional experience|employment|work history|skills|top skills|projects|certifications?|licenses|summary|about|languages|awards|honou?rs|publications|volunteer(ing)?)\b/i;
function withoutEducation(text: string): string {
  let skipping = false;
  return text
    .split("\n")
    .filter((line) => {
      if (/^\s*(education|academic background|qualifications)\b/i.test(line)) skipping = true;
      else if (skipping && SECTION.test(line)) skipping = false;
      return !skipping;
    })
    .join("\n");
}

// Years since the earliest start in a work date range ("Jan 2016 – Present"). Ignores Education,
// ranges that end before they start, and caps at 50, so stray numbers don't produce nonsense.
export function yearsOfExperience(text: string, now: Date): number | null {
  const thisYear = now.getFullYear();
  let earliest: number | null = null;
  for (const m of withoutEducation(text).matchAll(RANGE)) {
    const start = Number(m[1]);
    const end = m[3] ? thisYear : Number(m[2]);
    if (end < start || start > thisYear) continue;
    earliest = earliest == null ? start : Math.min(earliest, start);
  }
  if (earliest == null) return null;
  const years = thisYear - earliest;
  return years >= 0 && years <= 50 ? years : null;
}

export function extractResumeFacts(text: string, now: Date): ResumeFacts {
  const email = text.match(EMAIL)?.[0] ?? null;
  const linkedin = text.match(LINKEDIN)?.[0] ?? null;
  const github = text.match(GITHUB)?.[0] ?? null;
  const website =
    [...text.matchAll(URL_RE)]
      .map((m) => m[0])
      .find((u) => !/linkedin\.com|github\.com|@/i.test(u) && !(email && email.toLowerCase().endsWith(u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "")))) ?? null;
  return {
    email,
    phone: phoneIn(text),
    linkedinUrl: linkedin ? withScheme(linkedin) : null,
    githubUrl: github ? withScheme(github) : null,
    websiteUrl: website ? withScheme(website) : null,
    yearsExperience: yearsOfExperience(text, now),
  };
}
