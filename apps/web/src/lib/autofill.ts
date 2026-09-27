// Pure helpers for filling job-application forms outside LinkedIn (Greenhouse, Lever, Ashby,
// Workday and ordinary forms). Shared by the web app and the browser extension.
// The extension fills fields the user reviewed; it never submits. Demographic (EEO) and consent
// questions are always left for the user.

export type Ats = "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "workable";

export const ATS_NAMES: Record<Ats, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
};

export type AtsRef = { ats: Ats; board: string | null; jobId: string | null; externalId: string | null };

// Which applicant-tracking system a URL belongs to, plus the board and job id when the URL has them.
// externalId matches jobs.external_id for jobs found by Job Discovery ("greenhouse:stripe:123").
export function atsRef(url: string): AtsRef | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const ref = (ats: Ats, board: string | null, jobId: string | null): AtsRef => ({
    ats,
    board,
    jobId,
    externalId: board && jobId && (ats === "greenhouse" || ats === "lever" || ats === "ashby") ? `${ats}:${board}:${jobId}` : null,
  });

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    // boards.greenhouse.io/<board>/jobs/<id>, job-boards.greenhouse.io/<board>/jobs/<id>, …/embed/job_app?for=<board>&token=<id>
    if (parts[0] === "embed") return ref("greenhouse", u.searchParams.get("for"), u.searchParams.get("token"));
    const jobs = parts.indexOf("jobs");
    return ref("greenhouse", parts[0] ?? null, jobs >= 0 ? (parts[jobs + 1] ?? null) : null);
  }
  // Company careers pages that embed Greenhouse carry ?gh_jid=<id>.
  const ghJid = u.searchParams.get("gh_jid");
  if (ghJid && /^\d+$/.test(ghJid)) return { ats: "greenhouse", board: null, jobId: ghJid, externalId: null };
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") return ref("lever", parts[0] ?? null, parts[1] ?? null);
  if (host === "jobs.ashbyhq.com") return ref("ashby", parts[0] ?? null, parts[1] ?? null);
  if (/\.myworkdayjobs\.com$/.test(host) || /\.myworkdaysite\.com$/.test(host)) return ref("workday", host.split(".")[0], null);
  if (host === "jobs.smartrecruiters.com") return ref("smartrecruiters", parts[0] ?? null, parts[1]?.split("-")[0] ?? null);
  if (host === "apply.workable.com") return ref("workable", parts[0] ?? null, parts[2] ?? null);
  return null;
}

// ---- What the user has told us (sent by the server to the extension) ----

export type ApplicantFacts = {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  yearsExperience: number | null;
  authorizedCountries: string[];
  needsSponsorship: boolean;
  openToRelocate: boolean;
  salary: string | null;
  noticePeriod: string | null;
  howHeard: string | null;
};

export type AutofillData = {
  facts: ApplicantFacts;
  // Screening answers and cover note from the job's latest application kit, when there is one.
  answers: { question: string; answer: string }[];
  coverNote: string | null;
  hasResume: boolean;
};

// ---- Form fields (read from the page by the extension) ----

export type FieldKind = "text" | "email" | "tel" | "url" | "number" | "date" | "textarea" | "select" | "radio" | "checkbox" | "file" | "combobox";

export type FormField = {
  frameId: number;
  ref: string;
  kind: FieldKind;
  label: string;
  // name, id, autocomplete and placeholder, lowercased: extra hints for classification.
  hints: string;
  required: boolean;
  options: string[];
  hasValue: boolean;
};

export type FillAction = { frameId: number; ref: string; kind: FieldKind; label: string; value: string; source: string };
export type FillPlan = {
  actions: FillAction[];
  // Questions only the user (or an AI draft they review) can answer.
  open: { frameId: number; ref: string; kind: FieldKind; label: string; options: string[] }[];
  skipped: { label: string; reason: string }[];
};

type Key =
  | "demographic"
  | "consent"
  | "resume"
  | "cover_letter"
  | "first_name"
  | "last_name"
  | "preferred_name"
  | "full_name"
  | "email"
  | "phone"
  | "linkedin"
  | "github"
  | "portfolio"
  | "website"
  | "postal_code"
  | "city"
  | "region"
  | "country"
  | "location"
  | "current_company"
  | "current_title"
  | "years_experience"
  | "sponsorship"
  | "authorization"
  | "relocation"
  | "salary"
  | "notice"
  | "how_heard";

// Order matters: the first match wins.
const RULES: [Key, RegExp][] = [
  ["demographic", /\b(gender|race|racial|ethnic|ethnicity|hispanic|latin[oax]|veteran|disabilit|sexual orientation|pronoun|transgender|lgbt)/],
  ["resume", /\b(resume|résumé|cv)\b/],
  ["cover_letter", /cover\s*letter/],
  ["sponsorship", /sponsor/],
  ["authorization", /(authori[sz]ed|eligible|legally able|right) to work|work (authori[sz]ation|permit|eligibility)|legal right/],
  ["relocation", /relocat/],
  ["salary", /salary|compensation|pay (expectation|range|requirement)|desired pay|expected (pay|ctc)|\bctc\b/],
  ["notice", /notice period|start date|when can you start|available to start|earliest (possible )?start|availability to start/],
  ["how_heard", /how did you (hear|find|learn)|where did you (hear|find|see)|referral source|source of application/],
  ["linkedin", /linkedin/],
  ["github", /github/],
  ["portfolio", /portfolio|dribbble|behance/],
  ["first_name", /first[\s_-]*name|given[\s_-]*name|\bfname\b|given-name/],
  ["last_name", /last[\s_-]*name|family[\s_-]*name|surname|\blname\b|family-name/],
  ["preferred_name", /preferred[\s_-]*(first[\s_-]*)?name|nickname/],
  ["email", /e-?mail/],
  ["phone", /phone|mobile|\btel\b|telephone/],
  ["website", /website|personal (site|url)|\bblog\b|other (link|url)/],
  ["postal_code", /zip|postal|post code|postcode/],
  ["current_company", /current (company|employer)|(most recent|latest) (company|employer)|\bemployer\b|company name/],
  ["current_title", /current (job )?(title|role|position)|(most recent|latest) (title|role|position)|job title/],
  ["years_experience", /(how many|total|overall|number of) years|years of (professional |relevant |work )?experience/],
  ["city", /\bcity\b|\btown\b/],
  ["region", /\b(state|province|region|county)\b/],
  ["country", /\bcountry\b/],
  ["location", /location|where are you (based|located)|current address|\baddress\b|based in/],
  ["full_name", /\bfull[\s_-]*name\b|legal name|\byour name\b|^name\b|^name$/],
];

const CONSENT = /\b(i agree|agree to|consent|acknowledge|privacy (policy|notice)|terms|certify|confirm that|attest|gdpr|data (processing|retention))/;

export function classifyField(f: Pick<FormField, "label" | "hints" | "kind">): Key | null {
  const label = f.label.toLowerCase();
  const text = `${label} ${f.hints}`;
  if (RULES[0][1].test(text)) return "demographic";
  if (f.kind === "checkbox" && CONSENT.test(label)) return "consent";
  if (f.kind === "file") return /cover\s*letter/.test(text) ? "cover_letter" : "resume";
  // Skill-specific experience questions ("years of experience with Python") belong to the kit's answers.
  const skillSpecific = /years.{0,40}\b(with|in|using|of experience (with|in|using))\b/.test(label);
  for (const [key, re] of RULES.slice(1)) {
    if (key === "years_experience" && skillSpecific) continue;
    // Match on the visible label first; fall back to name/id/autocomplete for unlabeled inputs.
    if (re.test(label) || (!label.trim() && re.test(f.hints)) || (key !== "full_name" && re.test(f.hints) && label.length < 40)) return key;
  }
  return null;
}

// ---- Countries (for "Are you authorized to work in …?") ----

const COUNTRY_ALIASES: [string, RegExp][] = [
  ["united states", /\b(united states|u\.?s\.?a?\.?|america)\b/],
  ["united kingdom", /\b(united kingdom|u\.?k\.?|britain|great britain|england)\b/],
  ["canada", /\bcanada\b/],
  ["india", /\bindia\b/],
  ["australia", /\baustralia\b/],
  ["germany", /\bgermany\b/],
  ["france", /\bfrance\b/],
  ["ireland", /\bireland\b/],
  ["netherlands", /\b(netherlands|holland)\b/],
  ["singapore", /\bsingapore\b/],
  ["united arab emirates", /\b(united arab emirates|u\.?a\.?e\.?)\b/],
  ["japan", /\bjapan\b/],
  ["spain", /\bspain\b/],
  ["new zealand", /\bnew zealand\b/],
];

export function canonicalCountry(s: string): string | null {
  const t = s.toLowerCase().trim();
  return COUNTRY_ALIASES.find(([, re]) => re.test(t))?.[0] ?? (t || null);
}

// true/false when the question names a country we can check; null when the user must answer.
export function authorizedFor(label: string, authorizedCountries: string[]): boolean | null {
  if (!authorizedCountries.length) return null;
  const asked = COUNTRY_ALIASES.find(([, re]) => re.test(label.toLowerCase()))?.[0];
  if (!asked) return null;
  return authorizedCountries.some((c) => canonicalCountry(c) === asked);
}

// ---- Choosing among a select's or radio group's options ----

const isPlaceholder = (o: string) => !o.trim() || /^(select|choose|please select|--|—|pick)/i.test(o.trim());

export function pickYesNo(options: string[], yes: boolean): string | null {
  const re = yes ? /^\s*yes\b/i : /^\s*no\b/i;
  return options.find((o) => re.test(o)) ?? null;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["the", "and", "you", "your", "are", "for", "with", "have", "what", "this", "that", "our", "any", "please", "describe", "tell", "about", "why", "how", "does", "did", "will", "would", "can"]);

export function similarity(a: string, b: string): number {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size) * (shared / Math.max(A.size, B.size)) ** 0.5;
}

// The option that best matches a free-text value ("United States" → "United States of America").
export function pickOption(options: string[], value: string): string | null {
  const real = options.filter((o) => !isPlaceholder(o));
  const v = value.toLowerCase().trim();
  if (!v) return null;
  const exact = real.find((o) => o.toLowerCase().trim() === v);
  if (exact) return exact;
  if (/^(yes|no)\b/i.test(v)) return pickYesNo(real, /^yes/i.test(v));
  const contains = real.find((o) => o.toLowerCase().includes(v) || v.includes(o.toLowerCase().trim()));
  if (contains) return contains;
  const best = real.map((o) => [o, similarity(o, value)] as const).sort((x, y) => y[1] - x[1])[0];
  return best && best[1] >= 0.5 ? best[0] : null;
}

// ---- The plan ----

const url = (s: string | null) => s ?? null;

function valueFor(key: Key, f: FormField, d: AutofillData): { value: string | boolean | null; source: string } | { skip: string } {
  const x = d.facts;
  const place = [x.city, x.region, x.country].filter(Boolean).join(", ") || null;
  switch (key) {
    case "demographic":
      return { skip: "Demographic question: answer it yourself (or decline)" };
    case "consent":
      return { skip: "Consent checkbox: read it and tick it yourself" };
    case "resume":
      if (f.kind !== "file") return { skip: "Resume text box: paste it yourself if the form needs it" };
      return d.hasResume ? { value: "resume", source: "Your resume" } : { skip: "Upload a resume in Offerwing first" };
    case "cover_letter":
      if (f.kind === "file") return { skip: "Cover letter upload: attach one yourself if you want to" };
      return { value: d.coverNote, source: "Application kit" };
    case "first_name":
      return { value: x.firstName, source: "Application profile" };
    case "last_name":
      return { value: x.lastName, source: "Application profile" };
    case "preferred_name":
      return { value: x.preferredName ?? x.firstName, source: "Application profile" };
    case "full_name":
      return { value: [x.firstName, x.lastName].filter(Boolean).join(" ") || null, source: "Application profile" };
    case "email":
      return { value: x.email, source: "Application profile" };
    case "phone":
      return { value: x.phone, source: "Application profile" };
    case "linkedin":
      return { value: url(x.linkedinUrl), source: "Application profile" };
    case "github":
      return { value: url(x.githubUrl), source: "Application profile" };
    case "portfolio":
      return { value: url(x.portfolioUrl ?? x.websiteUrl), source: "Application profile" };
    case "website":
      return { value: url(x.websiteUrl ?? x.portfolioUrl), source: "Application profile" };
    case "postal_code":
      return { value: x.postalCode, source: "Application profile" };
    case "city":
      return { value: x.city, source: "Application profile" };
    case "region":
      return { value: x.region, source: "Application profile" };
    case "country":
      return { value: x.country, source: "Application profile" };
    case "location":
      return { value: place, source: "Application profile" };
    case "current_company":
      return { value: x.currentCompany, source: "Application profile" };
    case "current_title":
      return { value: x.currentTitle, source: "Application profile" };
    case "years_experience":
      return { value: x.yearsExperience != null ? String(x.yearsExperience) : null, source: "Application profile" };
    case "sponsorship":
      return { value: x.needsSponsorship, source: "Your preferences" };
    case "authorization":
      return { value: authorizedFor(f.label, x.authorizedCountries), source: "Application profile" };
    case "relocation":
      return { value: x.openToRelocate, source: "Your preferences" };
    case "salary":
      return { value: x.salary, source: "Your preferences" };
    case "notice":
      return { value: x.noticePeriod, source: "Your preferences" };
    case "how_heard":
      return { value: x.howHeard, source: "Application profile" };
  }
}

// Turns a value into what this field accepts, or null when it can't take it.
function fitToField(f: FormField, value: string | boolean): string | null {
  const choice = f.kind === "select" || f.kind === "radio" || f.kind === "combobox";
  if (typeof value === "boolean") {
    if (choice && f.options.length) return pickYesNo(f.options, value);
    if (f.kind === "checkbox") return null;
    return value ? "Yes" : "No";
  }
  if (!value.trim()) return null;
  if (choice && f.options.length) return pickOption(f.options, value);
  if (f.kind === "checkbox") return null;
  if (f.kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
  if (f.kind === "number") return /^\d+(\.\d+)?$/.test(value.trim()) ? value.trim() : null;
  return value;
}

export function planFill(fields: FormField[], data: AutofillData): FillPlan {
  const plan: FillPlan = { actions: [], open: [], skipped: [] };
  let resumeUsed = false;
  for (const f of fields) {
    const label = f.label.trim() || f.hints.split(" ")[0] || "Unlabeled field";
    if (f.hasValue && f.kind !== "file") continue; // never overwrite what's already there
    const key = classifyField(f);

    if (key) {
      const v = valueFor(key, f, data);
      if ("skip" in v) {
        plan.skipped.push({ label, reason: v.skip });
        continue;
      }
      if (key === "resume") {
        if (resumeUsed) continue;
        resumeUsed = true;
        plan.actions.push({ frameId: f.frameId, ref: f.ref, kind: f.kind, label, value: "resume", source: v.source });
        continue;
      }
      const fitted = v.value == null ? null : fitToField(f, v.value);
      if (fitted != null) {
        plan.actions.push({ frameId: f.frameId, ref: f.ref, kind: f.kind, label, value: fitted, source: v.source });
        continue;
      }
    }

    // Anything else: reuse an answer from the application kit if one clearly matches.
    const match = data.answers.map((a) => [a, similarity(a.question, f.label)] as const).sort((a, b) => b[1] - a[1])[0];
    if (match && match[1] >= 0.45 && f.kind !== "file") {
      const fitted = fitToField(f, match[0].answer);
      if (fitted != null) {
        plan.actions.push({ frameId: f.frameId, ref: f.ref, kind: f.kind, label, value: fitted, source: "Application kit" });
        continue;
      }
    }

    if (f.kind === "file" || f.kind === "checkbox") {
      if (f.required) plan.skipped.push({ label, reason: "Fill this one yourself" });
      continue;
    }
    if (f.label.trim()) plan.open.push({ frameId: f.frameId, ref: f.ref, kind: f.kind, label: f.label.trim(), options: f.options.filter((o) => !isPlaceholder(o)) });
  }
  return plan;
}

// A drafted answer fitted to its field (choices must match one of the options).
export function fitAnswer(field: { kind: FieldKind; options: string[] }, answer: string): string | null {
  return fitToField({ frameId: 0, ref: "", label: "", hints: "", required: false, hasValue: false, ...field }, answer);
}
