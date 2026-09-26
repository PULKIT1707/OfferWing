"use client";

import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  Gauge,
  Home,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/landing/Logo";

const NAV = [
  { href: "/dashboard", label: "Today", icon: Home },
  { href: "/dashboard/profile", label: "Profile health", icon: Gauge },
  { href: "/dashboard/jobs", label: "Jobs pipeline", icon: Briefcase },
  { href: "/dashboard/network", label: "Referrals & network", icon: Users },
  { href: "/dashboard/outreach", label: "Outreach", icon: MessageSquare },
  { href: "/dashboard/content", label: "Content", icon: Megaphone },
  { href: "/dashboard/interviews", label: "Interviews & offers", icon: CalendarCheck },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={`size-4 ${active ? "text-wing-soft" : ""}`} />
            <span className="flex-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ name, email }: { name: string | null; email: string | null }) {
  const initials = (name ?? email ?? "?").split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <div className="flex items-center gap-3 border-t border-white/10 pt-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wing text-sm font-semibold">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name ?? "Your account"}</p>
        <p className="truncate text-xs text-white/50">{email}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button aria-label="Log out" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ name, email }: { name: string | null; email: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink p-4 text-white lg:flex">
        <Link href="/dashboard" className="px-3 py-2">
          <Logo className="text-lg" />
        </Link>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <Account name={name} email={email} />
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden">
        <Link href="/dashboard">
          <Logo className="text-lg" />
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink p-4 text-white">
            <div className="flex items-center justify-between px-3 py-2">
              <Logo className="text-lg" />
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <Account name={name} email={email} />
          </div>
        </div>
      )}
    </>
  );
}
