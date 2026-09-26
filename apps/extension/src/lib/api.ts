import { APP_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Calls the Offerwing API as the signed-in user.
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError("Not connected", 401);
  const res = await fetch(`${APP_URL}${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((json as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return json as T;
}
