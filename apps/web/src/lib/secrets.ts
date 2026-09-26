import "server-only";
import { timingSafeEqual } from "node:crypto";

// Constant-time comparison for shared secrets (webhooks, cron).
export function secretMatches(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
export const isCronRequest = (req: Request) => secretMatches(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), process.env.CRON_SECRET);
