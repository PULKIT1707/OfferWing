"use client";

import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.8h3.6c2-1.9 3.2-4.7 3.2-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [sent, setSent] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function oauth(provider: "google" | "linkedin_oidc") {
    setError(null);
    setBusy(provider);
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
    if (error) {
      setError(
        error.message.includes("not enabled")
          ? `${provider === "google" ? "Google" : "LinkedIn"} sign-in isn't configured yet. Use email for now.`
          : error.message,
      );
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl(), data: { full_name: name } },
      });
      if (error) setError(error.message);
      else if (data.session) router.push(next);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      else {
        router.push(next);
        router.refresh();
      }
    }
    setBusy(null);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-wing/10">
          <Mail className="size-6 text-wing" />
        </div>
        <h1 className="headline mt-6 text-3xl font-semibold">Check your inbox</h1>
        <p className="mt-3 text-muted">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to start setting up Offerwing.
        </p>
      </div>
    );
  }

  const isSignup = mode === "signup";
  return (
    <div>
      <h1 className="headline text-4xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-muted">{isSignup ? "Free forever. Set up takes about 10 minutes." : "Log in to your job search command center."}</p>

      <div className="mt-8 grid gap-3">
        <button onClick={() => oauth("linkedin_oidc")} disabled={!!busy} className="flex items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
          {busy === "linkedin_oidc" ? <Loader2 className="size-4 animate-spin" /> : <span className="grid size-4 place-items-center rounded-sm bg-white text-[10px] font-bold text-[#0a66c2]">in</span>}
          Continue with LinkedIn
        </button>
        <button onClick={() => oauth("google")} disabled={!!busy} className="flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-card disabled:opacity-60">
          {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {isSignup && (
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-wing" />
        )}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-wing" />
        <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? "Password (8+ characters)" : "Password"} autoComplete={isSignup ? "new-password" : "current-password"} className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-wing" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button disabled={!!busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-wing px-4 py-3 text-sm font-medium text-white hover:bg-wing-soft disabled:opacity-60">
          {busy === "email" && <Loader2 className="size-4 animate-spin" />}
          {isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New to Offerwing? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-wing hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
      {isSignup && (
        <p className="mt-4 text-center text-xs text-muted">
          We never ask for your LinkedIn password. By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      )}
    </div>
  );
}
