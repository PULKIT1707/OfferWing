import { Agents } from "@/components/landing/Agents";
import { Extension } from "@/components/landing/Extension";
import { Faq } from "@/components/landing/Faq";
import { ForTeams } from "@/components/landing/ForTeams";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { Navbar } from "@/components/landing/Navbar";
import { Pricing } from "@/components/landing/Pricing";
import { Statement } from "@/components/landing/Statement";
import { Trust } from "@/components/landing/Trust";
import { ValueCards } from "@/components/landing/ValueCards";

export default function Home() {
  return (
    <main className="flex-1">
      <Navbar />
      <Hero />
      <ValueCards />
      <Features />
      <Extension />
      <Statement />
      <Trust />
      <Agents />
      <Pricing />
      <ForTeams />
      <Faq />
      <Footer />
    </main>
  );
}
