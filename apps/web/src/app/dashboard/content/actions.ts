"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  buildCommentPrompt,
  buildContentPlanPrompt,
  buildPostPrompt,
  COMMENT_SYSTEM,
  commentIdeasSchema,
  CONTENT_PLAN_SYSTEM,
  contentPlanSchema,
  POST_COLUMNS,
  POST_DRAFT_SYSTEM,
  postDraftSchema,
  type CommentIdeas,
  type ContentPost,
} from "@/lib/agents/content";
import { requireUser } from "@/lib/auth";
import { loadCareerText } from "@/lib/documents";
import { credentialForAgent } from "@/lib/llm/agent-credential";
import { UserFacingError } from "@/lib/llm/errors";
import { generateStructured } from "@/lib/llm/generate";
import { recordAgentRun } from "@/lib/llm/quota";
import { withDefaults } from "@/lib/onboarding";
import { dateInZone } from "@/lib/time";
import { userTimeZone } from "@/lib/user-time";

const friendly = (err: unknown, fallback: string) => {
  if (err instanceof UserFacingError) return err.message;
  console.error(fallback, err);
  return fallback;
};

export async function createContentPlan(): Promise<{ error?: string; added?: number }> {
  const { supabase, userId } = await requireUser();
  const credential = await credentialForAgent(supabase, userId, "content_plan");
  if ("error" in credential) return credential;
  try {
    const [{ data: search }, careerText] = await Promise.all([
      supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
      loadCareerText(supabase).catch(() => null),
    ]);
    const result = await generateStructured({
      credential,
      tier: "standard",
      system: CONTENT_PLAN_SYSTEM,
      prompt: buildContentPlanPrompt(withDefaults(search), careerText),
      schema: contentPlanSchema,
      schemaName: "content_plan",
    });
    await recordAgentRun(supabase, userId, "content_plan", credential, result.model);
    const tz = await userTimeZone(supabase, userId);
    const rows = result.data.posts.slice(0, 10).map((p) => ({
      user_id: userId,
      status: "idea",
      pillar: p.pillar.slice(0, 100),
      format: p.format,
      hook: p.hook.slice(0, 500),
      angle: p.angle.slice(0, 1000),
      planned_for: dateInZone(tz, Math.max(0, Math.min(30, Math.round(p.day)))),
    }));
    const { error } = await supabase.from("content_posts").insert(rows);
    if (error) return { error: "Couldn't save the plan." };
    revalidatePath("/dashboard/content");
    return { added: rows.length };
  } catch (err) {
    return { error: friendly(err, "Couldn't create your content plan. Please try again.") };
  }
}

export async function draftPost(postId: string): Promise<{ error?: string; post?: ContentPost }> {
  const { supabase, userId } = await requireUser();
  const { data: post } = await supabase.from("content_posts").select(POST_COLUMNS).eq("id", postId).maybeSingle();
  if (!post) return { error: "Post not found." };
  const credential = await credentialForAgent(supabase, userId, "post_draft");
  if ("error" in credential) return credential;
  try {
    const [{ data: search }, careerText] = await Promise.all([
      supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle(),
      loadCareerText(supabase).catch(() => null),
    ]);
    const result = await generateStructured({
      credential,
      tier: "standard",
      system: POST_DRAFT_SYSTEM,
      prompt: buildPostPrompt(post as ContentPost, withDefaults(search), careerText),
      schema: postDraftSchema,
      schemaName: "post_draft",
    });
    await recordAgentRun(supabase, userId, "post_draft", credential, result.model);
    const { data, error } = await supabase
      .from("content_posts")
      .update({
        status: "draft",
        body: result.data.body.slice(0, 3000),
        hook_options: result.data.hook_options.slice(0, 3),
        hashtags: result.data.hashtags.map((h) => h.replace(/^#/, "").replace(/\s+/g, "")).slice(0, 5),
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .select(POST_COLUMNS)
      .single();
    if (error || !data) return { error: "Couldn't save the draft." };
    revalidatePath("/dashboard/content");
    return { post: data as ContentPost };
  } catch (err) {
    return { error: friendly(err, "Couldn't write the post. Please try again.") };
  }
}

const postInput = z.object({
  hook: z.string().trim().min(1, "Add an opening line").max(500),
  angle: z.string().trim().max(1000).nullable(),
  body: z.string().trim().max(3000).nullable(),
  pillar: z.string().trim().max(100).nullable(),
  format: z.enum(["text", "carousel", "poll", "story"]),
  planned_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function savePost(id: string | null, input: unknown): Promise<{ error?: string }> {
  const parsed = postInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the post." };
  const { supabase, userId } = await requireUser();
  const values = { ...parsed.data, updated_at: new Date().toISOString(), ...(parsed.data.body ? { status: "draft" } : {}) };
  const { error } = id ? await supabase.from("content_posts").update(values).eq("id", id) : await supabase.from("content_posts").insert({ ...values, user_id: userId });
  if (error) return { error: "Couldn't save the post." };
  revalidatePath("/dashboard/content");
  return {};
}

export async function setPostStatus(id: string, status: "posted" | "archived" | "draft", postedUrl?: string): Promise<{ error?: string }> {
  const url = postedUrl?.trim() || null;
  if (url && !/^https?:\/\//i.test(url)) return { error: "Paste the full link to your post." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("content_posts").update({ status, ...(status === "posted" ? { posted_url: url } : {}), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Couldn't update the post." };
  revalidatePath("/dashboard/content");
  return {};
}

export async function suggestComments(postText: string, author: string): Promise<{ error?: string; ideas?: CommentIdeas }> {
  if (postText.trim().length < 40) return { error: "Paste the post you want to comment on." };
  const { supabase, userId } = await requireUser();
  const credential = await credentialForAgent(supabase, userId, "comment_ideas");
  if ("error" in credential) return credential;
  try {
    const { data: search } = await supabase.from("search_profiles").select("*").eq("user_id", userId).maybeSingle();
    const result = await generateStructured({
      credential,
      tier: "fast",
      system: COMMENT_SYSTEM,
      prompt: buildCommentPrompt(postText, author || "unknown", withDefaults(search)),
      schema: commentIdeasSchema,
      schemaName: "comment_ideas",
    });
    await recordAgentRun(supabase, userId, "comment_ideas", credential, result.model);
    return { ideas: { comments: result.data.comments.slice(0, 3).map((c) => ({ ...c, text: c.text.slice(0, 500) })) } };
  } catch (err) {
    return { error: friendly(err, "Couldn't suggest comments. Please try again.") };
  }
}
