import { strFromU8, unzipSync } from "fflate";
import Papa from "papaparse";
import { companyKey } from "@/lib/dashboard";

// Parses LinkedIn's "Get a copy of your data" ZIP. Keeps only what Referral Scout needs:
// no email addresses, and messages reduced to per-person counts and last-contact dates.

export type ParsedConnection = {
  full_name: string;
  profile_url: string | null;
  company: string | null;
  company_key: string | null;
  position: string | null;
  connected_on: string | null;
  message_count: number;
  last_message_at: string | null;
};

export type ParsedExport = {
  connections: ParsedConnection[];
  ownCompanies: string[];
  stats: { connections: number; withCompany: number; messagesScanned: number; ownPositions: number };
};

const WANTED = /(^|\/)(connections|messages|positions)\.csv$/i;

export function normalizeProfileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1])}` : null;
}

// LinkedIn CSVs can start with a "Notes:" preamble before the real header row.
function parseCsv(text: string, headerStartsWith: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((l) => l.replace(/"/g, "").toLowerCase().startsWith(headerStartsWith.toLowerCase()));
  if (start < 0) return [];
  const parsed = Papa.parse<Record<string, string>>(lines.slice(start).join("\n"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return parsed.data;
}

// "24 Sep 2026" or "09/24/26" → "2026-09-24".
function toIsoDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseLinkedInExport(zipBytes: Uint8Array): ParsedExport {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes, { filter: (f) => WANTED.test(f.name) });
  } catch {
    throw new Error("NOT_A_ZIP");
  }
  const find = (name: string) => {
    const key = Object.keys(files).find((k) => k.toLowerCase().endsWith(`${name}.csv`));
    return key ? strFromU8(files[key]) : null;
  };

  const connectionsCsv = find("connections");
  if (!connectionsCsv) throw new Error("NO_CONNECTIONS");

  // Message counts per profile URL, from both sent and received messages.
  const activity = new Map<string, { count: number; last: string | null }>();
  let messagesScanned = 0;
  const messagesCsv = find("messages");
  if (messagesCsv) {
    for (const row of parseCsv(messagesCsv, "CONVERSATION ID")) {
      messagesScanned++;
      const date = row["date"] ? new Date(row["date"]).toISOString() : null;
      const urls = [row["sender profile url"], ...(row["recipient profile urls"] ?? "").split(/[,\s]+/)];
      for (const url of new Set(urls.map(normalizeProfileUrl).filter(Boolean) as string[])) {
        const a = activity.get(url) ?? { count: 0, last: null };
        a.count++;
        if (date && (!a.last || date > a.last)) a.last = date;
        activity.set(url, a);
      }
    }
  }

  const connections: ParsedConnection[] = [];
  const seen = new Set<string>();
  for (const row of parseCsv(connectionsCsv, "First Name")) {
    const full_name = `${row["first name"] ?? ""} ${row["last name"] ?? ""}`.trim();
    if (!full_name) continue;
    const profile_url = normalizeProfileUrl(row["url"]);
    const dedupe = profile_url ?? `${full_name}|${row["company"] ?? ""}`.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const company = row["company"]?.trim() || null;
    const a = profile_url ? activity.get(profile_url) : undefined;
    connections.push({
      full_name,
      profile_url,
      company,
      company_key: companyKey(company),
      position: row["position"]?.trim() || null,
      connected_on: toIsoDate(row["connected on"]),
      message_count: a?.count ?? 0,
      last_message_at: a?.last ?? null,
    });
  }

  const positionsCsv = find("positions");
  const ownCompanies = positionsCsv
    ? [...new Set(parseCsv(positionsCsv, "Company Name").map((r) => r["company name"]?.trim()).filter(Boolean) as string[])]
    : [];

  return {
    connections,
    ownCompanies,
    stats: { connections: connections.length, withCompany: connections.filter((c) => c.company).length, messagesScanned, ownPositions: ownCompanies.length },
  };
}
