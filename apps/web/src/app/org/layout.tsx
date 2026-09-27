import Link from "next/link";
import { Logo } from "@/components/landing/Logo";
import { requireUser } from "@/lib/auth";

// Organization console (outplacement sponsors and recruiting teams). Separate from the job
// seeker's dashboard: org admins don't need to be job seekers themselves.
export default async function OrgLayout({ children }: LayoutProps<"/org">) {
  const { email } = await requireUser();
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-card">
      <header className="bg-ink px-4 py-3 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/org" className="flex items-center gap-3">
            <Logo className="text-lg" />
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium">Organizations</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/50 sm:inline">{email}</span>
            <Link href="/dashboard" className="text-white/70 hover:text-white">My job search</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
