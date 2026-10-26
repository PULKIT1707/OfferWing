"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loadPrefs, pollSources } from "@/lib/discovery";
import { fetchBoard, nameFromToken, parseCareersUrl } from "@/lib/job-sources";
import { MAX_TITLE_EXCLUDE } from "@/lib/source-kinds";

const SOURCE_COLUMNS = "id, user_id, kind, board_token, company_name, only_matching";
const MAX_SOURCES = 50;

export async function addJobSource(input: string): Promise<{ error?: string; added?: number; companyName?: string }> {
  const parsed = parseCareersUrl(input);
  if (!parsed) {
    return {
      error: "Paste a careers link from Greenhouse, Lever, Ashby, SmartRecruiters, Workable or Recruitee, like boards.greenhouse.io/stripe or apply.workable.com/company.",
    };
  }
  const { supabase, userId } = await requireUser();

  const { count } = await supabase.from("job_sources").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_SOURCES) return { error: `You can follow up to ${MAX_SOURCES} career boards.` };

  let companyName: string;
  try {
    const board = await fetchBoard(parsed.kind, parsed.token);
    companyName = board.companyName ?? nameFromToken(parsed.token);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const { data: source, error } = await supabase
    .from("job_sources")
    .insert({ user_id: userId, kind: parsed.kind, board_token: parsed.token, company_name: companyName })
    .select(SOURCE_COLUMNS)
    .single();
  if (error?.code === "23505") return { error: `You already follow ${companyName}'s careers page.` };
  if (error || !source) return { error: "Couldn't save that careers page. Please try again." };

  const { added } = await pollSources(supabase, [source], await loadPrefs(supabase, [userId]));
  revalidatePath("/dashboard", "layout");
  return { added, companyName };
}

// Words that keep a title out of the inbox, e.g. "intern", "contract", "interior".
export async function saveTitleExclusions(words: string[]): Promise<{ error?: string; saved?: string[] }> {
  const clean = [...new Set(words.map((w) => w.trim().toLowerCase().slice(0, 40)).filter(Boolean))];
  if (clean.length > MAX_TITLE_EXCLUDE) return { error: `Keep it to ${MAX_TITLE_EXCLUDE} words or fewer.` };
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from("search_profiles").update({ title_exclude: clean }).eq("user_id", userId);
  if (error) return { error: "Couldn't save those words. Please try again." };
  revalidatePath("/dashboard/settings");
  return { saved: clean };
}

export async function removeJobSource(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("job_sources").delete().eq("id", id);
  if (error) return { error: "Couldn't remove it. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function setSourceMatching(id: string, onlyMatching: boolean): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("job_sources").update({ only_matching: onlyMatching }).eq("id", id);
  if (error) return { error: "Couldn't update it. Please try again." };
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function checkSourcesNow(): Promise<{ error?: string; checked?: number; added?: number }> {
  const { supabase, userId } = await requireUser();
  const { data: sources } = await supabase.from("job_sources").select(SOURCE_COLUMNS);
  if (!sources?.length) return { error: "Follow a careers page first." };
  const result = await pollSources(supabase, sources, await loadPrefs(supabase, [userId]));
  revalidatePath("/dashboard", "layout");
  return result;
}
