import type { ApplicationKit } from "./application-tailor";

// Deterministic check that tailored content traces back to the candidate's documents.
// It can't prove a claim true, but it catches invented companies, titles, numbers and unsupported bullets.

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
const words = (s: string) => normalize(s).split(" ").filter((w) => w.length > 2).map(stem);

// Numbers in text, ignoring [placeholders]. "1,200" → "1200", "35%" → "35".
function numbersIn(s: string): string[] {
  const withoutPlaceholders = s.replace(/\[[^\]]*\]/g, " ");
  return [...withoutPlaceholders.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));
}

// Checks against one set of source documents, reused by every agent that makes claims about the user.
export function sourceChecker(sourceText: string) {
  const source = normalize(sourceText);
  const sourceStemmed = stemmed(sourceText);
  const sourceWords = new Set(words(sourceText));
  const sourceNumbers = new Set(numbersIn(sourceText));
  return {
    source,
    // A quote counts as supported when it appears verbatim, or 85% of its words do.
    supported: (quote: string) => {
      const q = normalize(quote);
      if (q.length < 8) return false;
      if (source.includes(q)) return true;
      const w = words(quote);
      return w.length > 0 && w.filter((x) => sourceWords.has(x)).length / w.length >= 0.85;
    },
    inventedNumbers: (text: string) => numbersIn(text).filter((n) => !sourceNumbers.has(n)),
    skillFound: (skill: string) => sourceStemmed.includes(stemmed(skill)),
  };
}

// Claims backed by a quote (fit points, highlights) plus free text that must not add numbers.
export function verifyClaims(claims: { where: string; text: string; evidence: string }[], texts: { where: string; text: string }[], sourceText: string): Verification {
  const { supported, inventedNumbers } = sourceChecker(sourceText);
  const flagged: Flag[] = [];
  const numberReason = (text: string) => {
    const n = inventedNumbers(text);
    return n.length ? [`Number${n.length > 1 ? "s" : ""} not in your documents: ${n.join(", ")}`] : [];
  };
  for (const c of claims) {
    const reasons = [...(supported(c.evidence) ? [] : ["Supporting quote not found in your documents"]), ...numberReason(c.text)];
    if (reasons.length) flagged.push({ where: c.where, text: c.text, reasons });
  }
  for (const t of texts) {
    const reasons = numberReason(t.text);
    if (reasons.length) flagged.push({ where: t.where, text: t.text, reasons });
  }
  return { checked: claims.length + texts.length, flagged, unverified_skills: [] };
}

export function verifyKit(kit: ApplicationKit, sourceText: string): Verification {
  const { source, supported, inventedNumbers, skillFound } = sourceChecker(sourceText);

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
    role.bullets.forEach((b) => {
      const numbers = inventedNumbers(b.text);
      check(`Experience · ${label}`, b.text, [
        ...(supported(b.evidence) ? [] : ["Supporting quote not found in your documents"]),
        ...(numbers.length ? [`Number${numbers.length > 1 ? "s" : ""} not in your documents: ${numbers.join(", ")}`] : []),
      ]);
    });
  });

  for (const [where, text] of [
    ["Summary", kit.resume.summary],
    ["Cover note", kit.cover_note],
    ["Connection note", kit.connection_note],
  ] as const) {
    const numbers = inventedNumbers(text);
    check(where, text, numbers.length ? [`Number${numbers.length > 1 ? "s" : ""} not in your documents: ${numbers.join(", ")}`] : []);
  }

  const unverified_skills = kit.resume.skills.filter((s) => !skillFound(s) && !supported(s));
  return { checked, flagged, unverified_skills };
}
