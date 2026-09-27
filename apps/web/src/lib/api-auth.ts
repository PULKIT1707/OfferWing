import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Authenticates browser-extension requests ("Authorization: Bearer <supabase access token>").
// The returned client acts as that user, so row-level security applies exactly as on the website.
export async function requireBearerUser(req: Request): Promise<{ supabase: SupabaseClient; userId: string; email: string | null } | NextResponse> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: "Session expired. Reconnect the extension." }, { status: 401 });
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null };
}

export const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });
