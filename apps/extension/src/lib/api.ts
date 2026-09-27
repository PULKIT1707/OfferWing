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

// Downloads a file from the Offerwing API as the signed-in user.
export async function apiFile(path: string): Promise<{ name: string; type: string; base64: string }> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError("Not connected", 401);
  const res = await fetch(`${APP_URL}${path}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError((json as { error?: string }).error ?? `Download failed (${res.status})`, res.status);
  }
  const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Resume";
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name, type: res.headers.get("content-type") ?? "application/octet-stream", base64: btoa(binary) };
}
