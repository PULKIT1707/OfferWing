// Pure helpers shared by the web app and the browser extension.

export function normalizeProfileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1])}` : null;
}

// /jobs/view/123…, or a search/collections page with ?currentJobId=123 → canonical job URL.
export function canonicalJobUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/.test(u.hostname)) return null;
    const id = u.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? u.searchParams.get("currentJobId");
    return id && /^\d+$/.test(id) ? `https://www.linkedin.com/jobs/view/${id}/` : null;
  } catch {
    return null;
  }
}

export function companySlug(url: string): string | null {
  return url.match(/linkedin\.com\/company\/([^/?#]+)/i)?.[1] ?? null;
}

export type PageKind = "job" | "profile" | "company" | "other";

export function pageKind(url: string): PageKind {
  if (canonicalJobUrl(url)) return "job";
  if (/linkedin\.com\/in\/[^/?#]+/i.test(url)) return "profile";
  if (companySlug(url)) return "company";
  return "other";
}
