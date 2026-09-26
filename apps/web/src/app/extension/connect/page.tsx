import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/landing/Logo";
import { ConnectExtension } from "./ConnectExtension";

export const metadata: Metadata = { title: "Connect extension · Offerwing" };

export default function ConnectExtensionPage() {
  return (
    <main className="grid min-h-screen flex-1 place-items-center bg-card px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center">
        <Link href="/dashboard" className="inline-block">
          <Logo className="text-lg" />
        </Link>
        <ConnectExtension extensionId={process.env.NEXT_PUBLIC_EXTENSION_ID ?? null} />
      </div>
    </main>
  );
}
