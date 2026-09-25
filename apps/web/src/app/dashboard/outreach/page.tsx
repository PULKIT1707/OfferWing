import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = { title: "Outreach · Offerwing" };

export default function OutreachPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      title="Outreach"
      subtitle="Your approval queue for invites, referral asks and follow-ups."
      features={[
        "Referral requests and intro asks drafted for the right person at each company",
        "Connection notes that fit LinkedIn's length limits and your plan's quotas",
        "Follow-up reminders on day 4 and day 10, then it stops",
        "Copy-ready drafts that open the right LinkedIn page for you to send",
      ]}
    />
  );
}
