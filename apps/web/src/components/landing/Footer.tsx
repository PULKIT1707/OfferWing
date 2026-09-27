import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="pixel-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="text-center">
          <h2 className="headline mx-auto max-w-3xl text-4xl font-semibold sm:text-6xl">Ready to land your next offer?</h2>
          <p className="mx-auto mt-4 max-w-lg text-white/60">Set up in 10 minutes. Your first profile audit is on us.</p>
          <a href="/signup" className="wing-glow mt-8 inline-flex items-center gap-2 rounded-xl bg-wing px-6 py-3.5 font-medium hover:bg-wing-soft transition-colors">
            Get started free <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="mt-24 grid gap-10 border-t border-white/10 pt-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo className="text-xl" />
            <p className="mt-4 max-w-xs text-sm text-white/55">AI agents for every step of your job search, from profile to offer.</p>
          </div>
          <div>
            <p className="font-medium">Product</p>
            <ul className="mt-4 space-y-2 text-sm text-white/60">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#extension" className="hover:text-white">Extension</a></li>
              <li><a href="#agents" className="hover:text-white">Agents</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#teams" className="hover:text-white">For teams</a></li>
            </ul>
          </div>
          <div>
            <p className="font-medium">Company</p>
            <ul className="mt-4 space-y-2 text-sm text-white/60">
              <li><a href="/privacy" className="hover:text-white">Privacy</a></li>
              <li><a href="/terms" className="hover:text-white">Terms</a></li>
              <li><a href="mailto:hello@offerwing.ai" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 py-8 text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Offerwing.</p>
          <p>Offerwing is not affiliated with or endorsed by LinkedIn Corporation.</p>
        </div>
      </div>
    </footer>
  );
}
