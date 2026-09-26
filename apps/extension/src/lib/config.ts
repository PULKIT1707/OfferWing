// Injected at build time (see build.mjs).
declare const __APP_URL__: string;
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

export const APP_URL = __APP_URL__;
export const SUPABASE_URL = __SUPABASE_URL__;
export const SUPABASE_KEY = __SUPABASE_KEY__;
