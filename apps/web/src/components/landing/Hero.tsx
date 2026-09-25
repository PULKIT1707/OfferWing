"use client";

import { ArrowRight, Check, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";

function Float({ children, className, delay = 0 }: { children: React.ReactNode; className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { duration: 0.8, delay },
        y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink text-white pt-32 pb-24 sm:pt-40">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[520px] -translate-x-1/2 rounded-full bg-wing/30 blur-[140px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-wing-soft" /> Free forever · bring your own AI key
          </span>
          <span className="inline-flex items-center gap-2 text-white/50">
            <Check className="size-4" /> Never auto-sends. Your account stays safe.
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="headline mx-auto mt-8 max-w-4xl text-5xl font-semibold sm:text-7xl"
        >
          Your AI wingman from <span className="text-wing-soft">profile</span> to <span className="text-offer">offer</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-white/65"
        >
          A team of AI agents that optimizes your LinkedIn profile, finds jobs that fit, surfaces people who can
          refer you, tailors every application and preps you for interviews. You stay in control of every click.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row justify-center gap-3"
        >
          <a href="/signup" className="wing-glow inline-flex items-center justify-center gap-2 rounded-xl bg-wing px-6 py-3.5 font-medium hover:bg-wing-soft transition-colors">
            Get started free <ArrowRight className="size-4" />
          </a>
          <a href="#extension" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-medium text-white/90 hover:bg-white/5 transition-colors">
            Add the Chrome extension
          </a>
        </motion.div>

        {/* Floating product preview */}
        <div className="relative mx-auto mt-20 h-[380px] max-w-4xl">
          <Float className="left-1/2 top-4 w-[300px] -translate-x-1/2" delay={0.4}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-left backdrop-blur-xl">
              <p className="text-xs text-white/50">Profile health</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative grid size-20 place-items-center rounded-full" style={{ background: "conic-gradient(var(--wing) 0 82%, rgba(255,255,255,.1) 82% 100%)" }}>
                  <div className="grid size-16 place-items-center rounded-full bg-ink text-2xl font-semibold">82</div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="text-offer">+31 since last week</p>
                  <p className="text-white/60">Search appearances ↑ 2.4×</p>
                  <p className="text-white/60">3 fixes left</p>
                </div>
              </div>
            </div>
          </Float>

          <Float className="left-0 top-44 hidden w-[280px] sm:block" delay={0.7}>
            <div className="rounded-3xl bg-white p-5 text-left text-ink shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Senior Product Designer</p>
                <span className="rounded-full bg-offer px-2.5 py-1 text-xs font-semibold">91% fit</span>
              </div>
              <p className="mt-1 text-sm text-muted">Remote · posted 6h ago · 14 applicants</p>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                {["Figma", "Design systems", "B2B SaaS"].map((s) => (
                  <span key={s} className="rounded-full bg-card px-2.5 py-1">{s}</span>
                ))}
              </div>
            </div>
          </Float>

          <Float className="right-0 top-36 hidden w-[290px] sm:block" delay={1}>
            <div className="rounded-3xl bg-white p-5 text-left text-ink shadow-2xl">
              <p className="flex items-center gap-2 text-xs text-muted">
                <Users className="size-3.5" /> Referral Scout
              </p>
              <p className="mt-2 font-semibold">3 people can refer you</p>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ["Priya S.", "Ex-colleague · Design Lead", "Best path"],
                  ["Marco T.", "Alumni · 2019", "Warm"],
                ].map(([n, r, t]) => (
                  <div key={n} className="flex items-center justify-between rounded-xl bg-card px-3 py-2">
                    <div>
                      <p className="font-medium">{n}</p>
                      <p className="text-xs text-muted">{r}</p>
                    </div>
                    <span className="text-xs font-medium text-wing">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </Float>
        </div>
      </div>
    </section>
  );
}
