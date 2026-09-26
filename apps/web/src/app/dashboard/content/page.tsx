import type { Metadata } from "next";
import { ContentView } from "@/components/dashboard/ContentView";
import { POST_COLUMNS, type ContentPost } from "@/lib/agents/content";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Content · Offerwing" };

// Planning and drafting call the AI model from server actions on this route.
export const maxDuration = 120;

export default async function ContentPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("content_posts").select(POST_COLUMNS).neq("status", "archived").order("planned_for", { ascending: true });
  return <ContentView posts={(data ?? []) as ContentPost[]} />;
}
