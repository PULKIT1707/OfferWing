import { canonicalJobUrl } from "@/lib/linkedin-urls";

// Parses emails forwarded to a user's alert address. Pure functions so they can be unit-tested.

export type AlertJob = { externalId: string; url: string; title: string; company: string | null; location: string | null };
export type InboundKind = "linkedin_alert" | "forwarding_confirmation" | "other";

export const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export const stripTags = (html: string) =>
  decodeEntities(html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|td|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

// Link text that isn't a job title.
const NOISE = /^(view( job)?|apply( now)?|easy apply|see (all|more)( jobs)?|save|dismiss|actively recruiting|promoted|new|\d+ (applicants?|connections?)|be an early applicant|school alumni|.{0,2})$/i;
const noiseLine = (s: string) => NOISE.test(s.trim()) || /https?:\/\//.test(s) || /^view job:/i.test(s);

export function classifyInbound(from: string, subject: string): InboundKind {
  const f = from.toLowerCase();
  if (/forwarding-noreply@google\.com/.test(f) || /forwarding confirmation/i.test(subject)) return "forwarding_confirmation";
  if (/@linkedin\.com/.test(f) && /job|alert/i.test(`${f} ${subject}`)) return "linkedin_alert";
  return "other";
}

// Gmail sends a confirmation to the forwarding address; the user must approve it in Gmail settings.
export function parseForwardingConfirmation(subject: string, text: string): { code: string | null; link: string | null } {
  const code = subject.match(/\(#(\d{5,})\)/)?.[1] ?? text.match(/confirmation code:\s*(\d{5,})/i)?.[1] ?? null;
  const link = text.match(/https:\/\/(?:mail-settings\.google\.com|mail\.google\.com)\/mail\/[^\s<>"')]+/)?.[0] ?? null;
  return { code, link };
}

function splitCompanyLocation(lines: string[]): { company: string | null; location: string | null } {
  const useful = lines.map((l) => l.trim()).filter((l) => l && !noiseLine(l));
  if (!useful.length) return { company: null, location: null };
  // "Stripe · San Francisco, CA (Remote)" on one line, or company then location on separate lines.
  const parts = useful[0].split(/\s[·•|]\s/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { company: parts[0], location: parts[1] };
  return { company: parts[0] ?? null, location: useful[1]?.split(/\s[·•|]\s/)[0] ?? null };
}

function fromHtml(html: string): AlertJob[] {
  const jobs = new Map<string, AlertJob>();
  const anchor = /<a\b[^>]*href="([^"]*\/jobs\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(anchor)];
  matches.forEach((m, i) => {
    const id = m[2];
    const text = stripTags(m[3]).split("\n").map((s) => s.trim()).find((s) => s && !noiseLine(s));
    if (!text) return;
    const url = canonicalJobUrl(decodeEntities(m[1]));
    if (!url) return;
    // Company and location follow the title link, up to the next job's link.
    const nextIndex = matches.slice(i + 1).find((n) => n[2] !== id)?.index ?? html.length;
    const after = stripTags(html.slice((m.index ?? 0) + m[0].length, nextIndex)).split("\n");
    const existing = jobs.get(id);
    if (existing && existing.title) return;
    jobs.set(id, { externalId: `linkedin:${id}`, url, title: text.slice(0, 200), ...splitCompanyLocation(after.slice(0, 4)) });
  });
  return [...jobs.values()];
}

function fromText(text: string): AlertJob[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const jobs = new Map<string, AlertJob>();
  lines.forEach((line, i) => {
    const m = line.match(/https?:\/\/\S*\/jobs\/view\/(\d+)\S*/);
    if (!m || jobs.has(m[1])) return;
    const url = canonicalJobUrl(m[0]);
    if (!url) return;
    // Title, company, location are the non-empty lines just above the link.
    const above: string[] = [];
    for (let j = i - 1; j >= 0 && above.length < 3; j--) {
      if (!lines[j]) {
        if (above.length) break;
        continue;
      }
      if (/\/jobs\/view\//.test(lines[j])) break;
      if (!noiseLine(lines[j])) above.unshift(lines[j]);
    }
    if (!above.length) return;
    const [title, ...rest] = above;
    jobs.set(m[1], { externalId: `linkedin:${m[1]}`, url, title: title.slice(0, 200), ...splitCompanyLocation(rest) });
  });
  return [...jobs.values()];
}

// Extracts job listings from a LinkedIn job-alert email. Prefers the HTML part, falls back to plain text.
export function parseLinkedInAlert(email: { html?: string | null; text?: string | null }): AlertJob[] {
  const html = email.html ? fromHtml(email.html) : [];
  const text = email.text ? fromText(email.text) : [];
  // Keep whichever found more, filling any missing company/location from the other.
  const [primary, secondary] = html.length >= text.length ? [html, text] : [text, html];
  return primary.slice(0, 50).map((j) => {
    const other = secondary.find((s) => s.externalId === j.externalId);
    return { ...j, company: j.company ?? other?.company ?? null, location: j.location ?? other?.location ?? null };
  });
}

// Local part of the address the email was sent to, if it's one of our alert addresses.
export function alertAliasFrom(recipients: string[], alertDomain: string): string | null {
  for (const r of recipients) {
    const m = r.toLowerCase().match(/([a-z0-9._+-]+)@([a-z0-9.-]+)/);
    if (m && m[2] === alertDomain.toLowerCase()) return m[1].split("+")[0];
  }
  return null;
}
