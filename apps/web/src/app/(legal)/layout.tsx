import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-white">
      <header className="bg-ink px-4 py-4 text-white sm:px-8">
        <Link href="/" aria-label="Offerwing home"><Logo className="text-lg" /></Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="mb-8 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Draft for legal review before public launch. It describes how Offerwing works today.
        </p>
        <article className="legal space-y-4 text-[15px] leading-relaxed text-foreground">{children}</article>
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link> · <Link href="/terms" className="hover:text-foreground">Terms</Link> · Offerwing is not affiliated with or endorsed by LinkedIn Corporation.
      </footer>
    </div>
  );
}
