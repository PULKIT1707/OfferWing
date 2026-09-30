import { NextResponse } from "next/server";
import { ingestInboundEmail, type InboundEmail } from "@/lib/discovery";
import { secretMatches } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";

// Receives emails sent to users' alert addresses (<alias>@alerts.offerwing.app) from an inbound-email
// provider. Supports Postmark-style JSON and SendGrid-style multipart form posts.
// Configure the provider to POST to /api/inbound/email?secret=<INBOUND_EMAIL_SECRET>.

const MAX_BYTES = 5 * 1024 * 1024;

const addresses = (v: unknown): string[] => (typeof v === "string" ? v.split(",") : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String((x as { Email?: string }).Email ?? ""))) : []);

async function readEmail(req: Request): Promise<InboundEmail | null> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = (await req.json()) as Record<string, unknown>;
    return {
      from: String(j.From ?? j.from ?? ""),
      subject: String(j.Subject ?? j.subject ?? ""),
      text: (j.TextBody ?? j.text ?? null) as string | null,
      html: (j.HtmlBody ?? j.html ?? null) as string | null,
      recipients: [...addresses(j.OriginalRecipient), ...addresses(j.ToFull ?? j.To ?? j.to), ...addresses(j.CcFull ?? j.Cc ?? j.cc)],
    };
  }
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const f = await req.formData();
    const get = (k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : null);
    let envelopeTo: string[] = [];
    try {
      envelopeTo = addresses((JSON.parse(get("envelope") ?? "{}") as { to?: string[] }).to);
    } catch {}
    return { from: get("from") ?? "", subject: get("subject") ?? "", text: get("text"), html: get("html"), recipients: [...envelopeTo, ...addresses(get("to"))] };
  }
  return null;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!secretMatches(url.searchParams.get("secret") ?? req.headers.get("x-offerwing-inbound-secret"), process.env.INBOUND_EMAIL_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Inbound email isn't configured (missing SUPABASE_SERVICE_ROLE_KEY)." }, { status: 503 });

  const email = await readEmail(req).catch(() => null);
  if (!email) return NextResponse.json({ error: "Unsupported payload" }, { status: 400 });
  // Always 200 for well-formed mail we choose to ignore, so the provider doesn't retry it.
  return NextResponse.json(await ingestInboundEmail(admin, email));
}
