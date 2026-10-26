import type { ApplicationKit } from "./application-tailor";

// Deterministic check that tailored content traces back to the candidate's documents.
// It can't prove a claim true, but it catches invented companies, titles, numbers, names and
// unsupported bullets, and claims that say more than the quote they cite.

export type Flag = { where: string; text: string; reasons: string[] };
export type Verification = { checked: number; flagged: Flag[]; unverified_skills: string[] };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9%+.#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Light plural folding so "design systems" matches "design system".
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const stemmed = (s: string) => normalize(s).split(" ").map(stem).join(" ");
// Sentence periods are trimmed ("customers." → "customers") but inner ones kept ("node.js").
const words = (s: string) =>
  normalize(s)
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 2)
    .map(stem);

// Numbers in text, ignoring [placeholders]. "1,200" → "1200", "35%" → "35".
function numbersIn(s: string): string[] {
  const withoutPlaceholders = s.replace(/\[[^\]]*\]/g, " ");
  return [...withoutPlaceholders.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

// Verbs that claim ownership or leadership. A bullet may only use one when its own supporting quote
// does too: "Led the platform team" backed by "Worked on the platform team" is a new claim.
// Each entry: [pattern for the verb in the bullet, stems that count as support in the quote].
const CLAIM_VERBS: [RegExp, string[], string][] = [
  [/\b(?:led|leads|leading)\b/i, ["led", "lead"], "led"],
  [/\b(?:managed|manages|managing)\b/i, ["manag"], "managed"],
  [/\b(?:directed|directs|directing)\b/i, ["direct"], "directed"],
  [/\b(?:founded|co-?founded|founding)\b/i, ["found"], "founded"],
  [/\b(?:owned|owns|owning)\b/i, ["own"], "owned"],
  [/\b(?:built|builds|building)\b/i, ["buil"], "built"],
  [/\b(?:architected|architecting)\b/i, ["architect"], "architected"],
  [/\b(?:launched|launches|launching)\b/i, ["launch"], "launched"],
  [/\b(?:created|creates|creating)\b/i, ["creat"], "created"],
  [/\b(?:spearheaded|spearheading)\b/i, ["spearhead"], "spearheaded"],
  [/\b(?:established|establishing)\b/i, ["establish"], "established"],
];

function strongerVerbs(text: string, quote: string): string[] {
  const q = normalize(quote).split(" ");
  return CLAIM_VERBS.filter(([re, stems]) => re.test(text) && !q.some((w) => stems.some((s) => w.startsWith(s)))).map(([, , label]) => label);
}

const NOT_NAMES = new Set(
  "i a an the and or of to in on for with by at as from our my we you it this that these those our their his her q1 q2 q3 q4 ceo cto cfo coo vp us usa uk eu jan feb mar apr may jun jul aug sep sept oct nov dec january february march april june july august september october november december monday tuesday wednesday thursday friday saturday sunday".split(
    " ",
  ),
);

// Capitalized words after the first word of each sentence: company, product and tool names.
function namesIn(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.replace(/\[[^\]]*\]/g, " ").split(/[.!?;:•\n]+/)) {
    const tokens = sentence.trim().split(/\s+/).slice(1);
    for (const raw of tokens) {
      const t = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, "");
      if (t.length >= 2 && /^[A-Z]/.test(t) && !NOT_NAMES.has(t.toLowerCase())) out.push(t);
    }
  }
  return [...new Set(out)];
}

export type QuoteMatch = "exact" | "loose" | "none";

// Checks against one set of source documents, reused by every agent that makes claims about the user.
export function sourceChecker(sourceText: string) {
  const source = normalize(sourceText);
  const sourceStemmed = stemmed(sourceText);
  const sourceWords = new Set(words(sourceText));
  const sourceNumbers = new Set(numbersIn(sourceText));
  // "exact": the quote appears verbatim (after normalizing). "loose": at least 85% of its words
  // appear somewhere in the documents, which a reworded sentence with a changed meaning can pass.
  const quoteMatch = (quote: string): QuoteMatch => {
    const q = normalize(quote);
    if (q.length < 8) return "none";
    if (source.includes(q)) return "exact";
    const w = words(quote);
    return w.length > 0 && w.filter((x) => sourceWords.has(x)).length / w.length >= 0.85 ? "loose" : "none";
  };
  const inventedNumbers = (text: string) => numbersIn(text).filter((n) => !sourceNumbers.has(n));
  const inventedNames = (text: string) => namesIn(text).filter((n) => !source.includes(normalize(n)));
  return {
    source,
    quoteMatch,
    supported: (quote: string) => quoteMatch(quote) !== "none",
    inventedNumbers,
    inventedNames,
    skillFound: (skill: string) => sourceStemmed.includes(stemmed(skill)),
    // Everything wrong with one claim and the quote it cites.
    claimReasons: (text: string, evidence: string): string[] => {
      const reasons: string[] = [];
      const match = quoteMatch(evidence);
      if (match === "none") reasons.push("Supporting quote not found in your documents");
      if (match === "loose") reasons.push("Supporting quote only loosely matches your documents. Check the wording still says the same thing");
      const invented = inventedNumbers(text);
      if (invented.length) reasons.push(`${plural(invented.length, "Number", "Numbers")} not in your documents: ${invented.join(", ")}`);
      const quoteNumbers = new Set(numbersIn(evidence));
      const unquoted = numbersIn(text).filter((n) => !quoteNumbers.has(n) && !invented.includes(n));
      if (unquoted.length) reasons.push(`${plural(unquoted.length, "Number", "Numbers")} not in this claim's supporting quote: ${unquoted.join(", ")}`);
      const verbs = strongerVerbs(text, evidence);
      if (verbs.length) reasons.push(`Says "${verbs.join('", "')}", but the supporting quote doesn't`);
      const names = inventedNames(text);
      if (names.length) reasons.push(`${plural(names.length, "Name", "Names")} not in your documents: ${names.join(", ")}`);
      return reasons;
    },
  };
}

const numberReason = (invented: string[]) => (invented.length ? [`${plural(invented.length, "Number", "Numbers")} not in your documents: ${invented.join(", ")}`] : []);

// Claims backed by a quote (fit points, highlights) plus free text that must not add numbers.
export function verifyClaims(claims: { where: string; text: string; evidence: string }[], texts: { where: string; text: string }[], sourceText: string): Verification {
  const { claimReasons, inventedNumbers } = sourceChecker(sourceText);
  const flagged: Flag[] = [];
  for (const c of claims) {
    const reasons = claimReasons(c.text, c.evidence);
    if (reasons.length) flagged.push({ where: c.where, text: c.text, reasons });
  }
  for (const t of texts) {
    const reasons = numberReason(inventedNumbers(t.text));
    if (reasons.length) flagged.push({ where: t.where, text: t.text, reasons });
  }
  return { checked: claims.length + texts.length, flagged, unverified_skills: [] };
}

export function verifyKit(kit: ApplicationKit, sourceText: string): Verification {
  const { source, supported, claimReasons, inventedNumbers, skillFound } = sourceChecker(sourceText);

  const flagged: Flag[] = [];
  let checked = 0;
  const check = (where: string, text: string, reasons: string[]) => {
    checked++;
    if (reasons.length) flagged.push({ where, text, reasons });
  };

  kit.resume.experience.forEach((role) => {
    const label = `${role.title} at ${role.company}`;
    check(`Experience · ${label}`, label, [
      ...(supported(role.company) || source.includes(normalize(role.company)) ? [] : ["Company name not found in your documents"]),
      ...(source.includes(normalize(role.title)) ? [] : ["Job title doesn't match your documents exactly"]),
    ]);
    role.bullets.forEach((b) => check(`Experience · ${label}`, b.text, claimReasons(b.text, b.evidence)));
  });

  // Free text may name the target company and role, so only numbers are checked here.
  for (const [where, text] of [
    ["Summary", kit.resume.summary],
    ["Cover note", kit.cover_note],
    ["Connection note", kit.connection_note],
  ] as const) {
    check(where, text, numberReason(inventedNumbers(text)));
  }

  const unverified_skills = kit.resume.skills.filter((s) => !skillFound(s) && !supported(s));
  return { checked, flagged, unverified_skills };
}

// AI-extracted text that gets reused later (the story bank feeds prep packs and practice) must not
// carry a number the documents don't contain: once saved, a guessed figure reads like a fact and
// spreads. Swaps each such number for a [placeholder] the candidate can fill in.
export function replaceInventedNumbers(text: string, sourceText: string): string {
  const known = new Set(numbersIn(sourceText));
  return text.replace(/(\[[^\]]*\])|\d[\d,]*(?:\.\d+)?/g, (m, placeholder: string | undefined) =>
    placeholder || known.has(m.replace(/,/g, "")) ? m : "[X]",
  );
}
