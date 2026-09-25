"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const links = [
  ["Features", "#features"],
  ["Extension", "#extension"],
  ["Agents", "#agents"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${
        scrolled ? "bg-ink/85 backdrop-blur-md border-b border-white/10" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 text-white">
        <a href="#" aria-label="Offerwing home">
          <Logo className="text-lg" />
        </a>
        <ul className="hidden md:flex items-center gap-8 text-sm text-white/80">
          {links.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="hover:text-white transition-colors">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="text-sm text-white/80 hover:text-white">
            Log in
          </a>
          <a href="/signup" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors">
            Get started free
          </a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <div className="md:hidden bg-ink border-t border-white/10 px-4 pb-6 text-white">
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block py-3 text-white/80">
              {label}
            </a>
          ))}
          <a href="/signup" className="mt-2 block rounded-xl bg-wing px-4 py-3 text-center font-medium">
            Get started free
          </a>
        </div>
      )}
    </header>
  );
}
