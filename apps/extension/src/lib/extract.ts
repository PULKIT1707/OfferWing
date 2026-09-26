// Runs inside the LinkedIn tab via chrome.scripting.executeScript, only when the user clicks "Analyze".
// It must be fully self-contained (no imports or outer variables): Chrome serializes the function.
// It reads what's visible on the page; it never clicks, scrolls or changes anything.

export type Extracted = {
  url: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  name: string | null;
  headline: string | null;
};

export function extractPage(): Extracted {
  const clean = (s: string | null | undefined) => (s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() || null;
  const first = (selectors: string[]) => {
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      const text = clean(el?.innerText ?? el?.textContent);
      if (text) return text;
    }
    return null;
  };

  // Job pages are titled like "(3) Senior Product Designer | Stripe | LinkedIn".
  const titleParts = document.title.replace(/^\(\d+\)\s*/, "").split(" | ").map((s) => s.trim());
  const isJob = /\/jobs\//.test(location.pathname);
  const isCompany = /\/company\//.test(location.pathname);

  const title = isJob
    ? first([".job-details-jobs-unified-top-card__job-title", ".jobs-unified-top-card__job-title", ".t-24.job-details-jobs-unified-top-card__job-title", "h1"]) ??
      (titleParts.length >= 3 ? titleParts[0] : null)
    : null;
  const company = isJob
    ? first([".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name", ".job-details-jobs-unified-top-card__primary-description a"]) ??
      (titleParts.length >= 3 ? titleParts[1] : null)
    : isCompany
      ? first(["h1"]) ?? clean(titleParts[0]?.split(":")[0])
      : null;
  const locationText = isJob
    ? first([".job-details-jobs-unified-top-card__primary-description-container .tvm__text", ".job-details-jobs-unified-top-card__bullet", ".jobs-unified-top-card__bullet"])
    : null;
  const description = isJob
    ? first(["#job-details", ".jobs-description__content", ".jobs-box__html-content", ".jobs-description", "[class*='jobs-description']"])
    : null;

  const isProfile = /^\/in\//.test(location.pathname);
  return {
    url: location.href,
    title: title?.slice(0, 200) ?? null,
    company: company?.split("\n")[0].slice(0, 200) ?? null,
    location: locationText?.split("·")[0].trim().slice(0, 200) ?? null,
    description: description?.slice(0, 20000) ?? null,
    name: isProfile ? first(["h1"]) : null,
    headline: isProfile ? first([".text-body-medium.break-words", ".pv-text-details__left-panel .text-body-medium"]) : null,
  };
}
