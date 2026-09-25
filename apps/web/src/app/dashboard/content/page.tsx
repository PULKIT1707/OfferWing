import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/ComingSoon";

export const metadata: Metadata = { title: "Content · Offerwing" };

export default function ContentPage() {
  return (
    <ComingSoon
      icon={Megaphone}
      title="Content"
      subtitle="Build visibility with hiring managers in your field."
      features={[
        "A weekly post plan built around your expertise",
        "Post drafts written in your voice from your writing samples",
        "Comment ideas for posts by people at your target companies",
        "Publishing only after you approve, plus performance tracking",
      ]}
    />
  );
}
