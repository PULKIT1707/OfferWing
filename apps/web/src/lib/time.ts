// Calendar dates in a user's time zone (IANA name, e.g. "America/Los_Angeles").

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// YYYY-MM-DD for today (plus `offsetDays`) in the given zone; UTC if the zone is missing or invalid.
export function dateInZone(tz: string | null | undefined, offsetDays = 0, now = new Date()): string {
  const zone = isValidTimeZone(tz) ? tz : "UTC";
  const today = now.toLocaleDateString("en-CA", { timeZone: zone });
  if (!offsetDays) return today;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Monday of the current week in the given zone.
export function weekStartInZone(tz: string | null | undefined, now = new Date()): string {
  const today = dateInZone(tz, 0, now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
