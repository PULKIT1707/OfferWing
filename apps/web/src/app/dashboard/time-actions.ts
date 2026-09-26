"use server";

import { requireUser } from "@/lib/auth";
import { isValidTimeZone } from "@/lib/time";

// Called by the dashboard with the browser's time zone so "today" matches the user's calendar.
export async function syncTimeZone(tz: string): Promise<void> {
  if (!isValidTimeZone(tz)) return;
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ time_zone: tz }).eq("id", userId);
}
