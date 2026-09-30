"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { goToStep } from "@/app/onboarding/actions";
import { Logo } from "@/components/landing/Logo";
import { STEPS, type AiSettings, type CareerDocument, type SearchProfile, type StepId } from "@/lib/onboarding";
import { AiStep, ConnectStep, DocumentsStep } from "./steps-setup";
import { CareerStep, LinkedinStep, PreferencesStep } from "./steps-profile";

type Props = {
  userId: string;
  firstName: string | null;
  alertAddress: string;
  initialStep: StepId;
  initialProfile: SearchProfile;
  initialAi: AiSettings;
  initialDocuments: CareerDocument[];
};

export function Wizard({ userId, firstName, alertAddress, initialStep, initialProfile, initialAi, initialDocuments }: Props) {
  const [step, setStep] = useState<StepId>(initialStep);
  const [furthest, setFurthest] = useState(STEPS.findIndex((s) => s.id === initialStep));
  const [profile, setProfile] = useState(initialProfile);
  const [ai, setAi] = useState(initialAi);
  const [documents, setDocuments] = useState(initialDocuments);
  const index = STEPS.findIndex((s) => s.id === step);

  const go = (i: number) => {
    const target = STEPS[i].id;
    setStep(target);
    setFurthest((f) => Math.max(f, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
    void goToStep(target);
  };
  const next = (patch?: Partial<SearchProfile>) => {
    if (patch) setProfile((p) => ({ ...p, ...patch }));
    go(index + 1);
  };
  const back = () => go(index - 1);

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[320px_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-8 text-white lg:block">
        <div className="pixel-grid pointer-events-none absolute inset-0" />
        <div className="relative flex h-full flex-col">
          <Link href="/" aria-label="Offerwing home">
            <Logo className="text-lg" />
          </Link>
          <p className="mt-12 text-sm text-white/50">Set up {firstName ? `for ${firstName}` : "your account"}</p>
          <ol className="mt-6 space-y-1">
            {STEPS.map((s, i) => {
              const done = i !== index && i < furthest;
              const reachable = i <= furthest;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => go(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === index ? "bg-white/10" : reachable ? "hover:bg-white/5" : "opacity-40"}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${i === index ? "bg-wing" : done ? "bg-white/15 text-offer" : "border border-white/20"}`}>
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="block text-xs text-white/50">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-auto text-xs text-white/40">Your answers save as you go. Change anything later in Settings.</p>
        </div>
      </aside>

      <main className="px-4 py-8 sm:px-10 lg:py-14">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 lg:hidden">
            <Logo className="text-lg" />
            <div className="mt-6 flex gap-1.5">
              {STEPS.map((s, i) => (
                <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-wing" : "bg-line"}`} />
              ))}
            </div>
          </div>
          <p className="mb-3 text-sm font-medium text-wing">Step {index + 1} of {STEPS.length}</p>

          {step === "career" && <CareerStep profile={profile} onDone={next} />}
          {step === "preferences" && <PreferencesStep profile={profile} onDone={next} onBack={back} />}
          {step === "linkedin" && <LinkedinStep profile={profile} onDone={next} onBack={back} />}
          {step === "documents" && <DocumentsStep userId={userId} documents={documents} onDocuments={setDocuments} onDone={() => next()} onBack={back} />}
          {step === "ai" && <AiStep ai={ai} onAi={setAi} onDone={() => next()} onBack={back} />}
          {step === "connect" && <ConnectStep address={alertAddress} onBack={back} />}
        </div>
      </main>
    </div>
  );
}
