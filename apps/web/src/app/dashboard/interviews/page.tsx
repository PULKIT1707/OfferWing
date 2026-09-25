import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = { title: "Interviews & offers · Offerwing" };

export default function InterviewsPage() {
  return (
    <ComingSoon
      icon={CalendarCheck}
      title="Interviews & offers"
      subtitle="Prep for every stage and compare offers with confidence."
      features={[
        "Company and interviewer briefs before each round",
        "Likely questions mapped to your own STAR stories",
        "Mock interviews with feedback on structure and specifics",
        "Offer comparison and negotiation scripts",
      ]}
    />
  );
}
