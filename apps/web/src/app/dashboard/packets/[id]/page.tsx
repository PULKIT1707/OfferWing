import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PacketEditor, type PacketRow } from "@/components/dashboard/PacketEditor";
import { isPacketGenerating } from "@/lib/agents/referral-packet";
import { appOrigin } from "@/lib/app-url";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Referral packet · Offerwing" };

// Writing the packet runs in after() from actions on other routes; this page only polls.
export default async function PacketPage(props: PageProps<"/dashboard/packets/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireUser();
  const { data: packet } = await supabase
    .from("referral_packets")
    .select("id, token, status, referrer_name, candidate_name, headline, fit_points, blurb, note_to_referrer, include_resume, kit_id, verification, error, views, last_viewed_at, expires_at, created_at, jobs(id, title, company)")
    .eq("id", id)
    .maybeSingle();
  if (!packet) notFound();

  return <PacketEditor packet={packet as unknown as PacketRow} generating={isPacketGenerating(packet)} shareUrl={`${await appOrigin()}/r/${packet.token}`} />;
}
