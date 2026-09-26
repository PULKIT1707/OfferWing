"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncTimeZone } from "@/app/dashboard/time-actions";

// Saves the browser's time zone when it differs from the one on file (first visit, travel).
export function TimeZoneSync({ current }: { current: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) void syncTimeZone(tz).then(() => router.refresh());
  }, [current, router]);
  return null;
}
