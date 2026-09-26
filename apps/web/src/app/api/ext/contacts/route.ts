import { NextResponse } from "next/server";
import { z } from "zod";
import { CONNECTION_COLUMNS, type Connection } from "@/lib/agents/referral-scout";
import { jsonError, requireBearerUser } from "@/lib/api-auth";
import { ensureContactForConnection } from "@/lib/referrals";

const body = z.object({ connectionId: z.string().uuid(), jobId: z.string().uuid().nullable().optional() });

// Adds an imported connection to the referral list.
export async function POST(req: Request) {
  const auth = await requireBearerUser(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase, userId } = auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");

  const { data: c } = await supabase.from("connections").select(CONNECTION_COLUMNS).eq("id", parsed.data.connectionId).maybeSingle();
  if (!c) return jsonError("Connection not found.", 404);
  const contact = await ensureContactForConnection(supabase, userId, c as Connection, parsed.data.jobId ?? null);
  if (!contact) return jsonError("Couldn't add them to your list.", 500);
  return NextResponse.json({ contactId: contact.id, referral_status: contact.referral_status });
}
