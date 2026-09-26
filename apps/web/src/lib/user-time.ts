import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateInZone } from "./time";

export async function userTimeZone(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("time_zone").eq("id", userId).maybeSingle();
  return data?.time_zone ?? null;
}

// Today (plus offsetDays) on the user's own calendar.
export async function userDate(supabase: SupabaseClient, userId: string, offsetDays = 0): Promise<string> {
  return dateInZone(await userTimeZone(supabase, userId), offsetDays);
}
