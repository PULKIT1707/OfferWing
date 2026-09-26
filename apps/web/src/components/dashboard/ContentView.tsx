"use client";

import { Archive, CalendarDays, Check, ExternalLink, Loader2, MessageCircle, Pencil, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createContentPlan, draftPost, savePost, setPostStatus, suggestComments } from "@/app/dashboard/content/actions";
import { linkedInShareUrl, type CommentIdeas, type ContentPost } from "@/lib/agents/content";
import { inputClass } from "@/components/onboarding/fields";
import { CopyButton } from "./CopyButton";
import { Button, Card, EmptyState, label, Modal, PageHeader } from "./ui";

const FORMAT_LABEL: Record<ContentPost["format"], string> = { text: "Text", carousel: "Carousel", poll: "Poll", story: "Story" };
const fmtDay = (d: string | null) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Unscheduled");
const fullText = (p: Pick<ContentPost, "body" | "hashtags">) => `${p.body ?? ""}${p.hashtags.length ? `\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}` : ""}`;

function Editor({ post, onDone }: { post: ContentPost | null; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    hook: post?.hook ?? "",
    angle: post?.angle ?? "",
    body: post?.body ?? "",
    pillar: post?.pillar ?? "",
    format: post?.format ?? ("text" as ContentPost["format"]),
    planned_for: post?.planned_for ?? "",
  });
  const set = (p: Partial<typeof v>) => setV((prev) => ({ ...prev, ...p }));
  const [postedUrl, setPostedUrl] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const blank = (s: string) => (s.trim() ? s : null);
  const payload = () => ({ hook: v.hook, angle: blank(v.angle), body: blank(v.body), pillar: blank(v.pillar), format: v.format, planned_for: blank(v.planned_for) });

  // Swap the post's first line for one of the suggested hooks.
  const applyHook = (h: string) => {
    const lines = v.body.split("\n");
    set({ body: [h, ...lines.slice(1)].join("\n") });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label className={label} htmlFor="c-hook">Idea / hook</label><input id="c-hook" className={inputClass} value={v.hook} onChange={(e) => set({ hook: e.target.value })} /></div>
        <div><label className={label} htmlFor="c-day">Publish on</label><input id="c-day" type="date" className={inputClass} value={v.planned_for} onChange={(e) => set({ planned_for: e.target.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label className={label} htmlFor="c-pillar">Pillar</label><input id="c-pillar" className={inputClass} value={v.pillar} onChange={(e) => set({ pillar: e.target.value })} /></div>
        <div><label className={label} htmlFor="c-format">Format</label><select id="c-format" className={inputClass} value={v.format} onChange={(e) => set({ format: e.target.value as ContentPost["format"] })}>{Object.entries(FORMAT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <div><label className={label} htmlFor="c-angle">Angle</label><input id="c-angle" className={inputClass} value={v.angle} onChange={(e) => set({ angle: e.target.value })} /></div>
      <div>
        <label className={label} htmlFor="c-body">Post</label>
        <textarea id="c-body" rows={10} className={inputClass} value={v.body} onChange={(e) => set({ body: e.target.value })} placeholder="Write it yourself, or save and use “Write draft”." />
        <p className="mt-1 text-xs text-muted">{v.body.length}/3,000 characters · the first ~200 show before “see more”</p>
      </div>
      {post && post.hook_options.length > 0 && (
        <div>
          <p className={label}>Other opening lines</p>
          <div className="space-y-1.5">{post.hook_options.map((h) => <button key={h} type="button" onClick={() => applyHook(h)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-wing">{h}</button>)}</div>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
          {post && v.body.trim() && (
            <>
              <CopyButton text={fullText({ body: v.body, hashtags: post.hashtags })} label="Copy post" />
              <a href={linkedInShareUrl(fullText({ body: v.body, hashtags: post.hashtags }))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-wing hover:text-wing">
                <ExternalLink className="size-3.5" /> Open in LinkedIn
              </a>
            </>
          )}
        </div>
        <Button disabled={pending} onClick={() => start(async () => { const r = await savePost(post?.id ?? null, payload()); if (r.error) setError(r.error); else { router.refresh(); onDone(); } })}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </Button>
      </div>
      {post && post.status !== "posted" && v.body.trim() && (
        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm font-medium">Posted it?</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input className={inputClass} value={postedUrl} onChange={(e) => setPostedUrl(e.target.value)} placeholder="Link to your post (optional)" aria-label="Link to your post" />
            <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await savePost(post.id, payload()); const r = await setPostStatus(post.id, "posted", postedUrl); if (r.error) setError(r.error); else { router.refresh(); onDone(); } })}>
              <Check className="size-4" /> Mark as posted
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentHelper() {
  const [post, setPost] = useState("");
  const [author, setAuthor] = useState("");
  const [ideas, setIdeas] = useState<CommentIdeas>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-wing" /> Comment ideas</h2>
      <p className="mt-1 text-sm text-muted">Thoughtful comments on posts by people at your target companies get you noticed. Paste a post to get three options.</p>
      <div className="mt-4 space-y-2">
        <input className={inputClass} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author, e.g. Maya Chen, Design Director at Stripe" aria-label="Post author" />
        <textarea rows={4} className={inputClass} value={post} onChange={(e) => setPost(e.target.value)} placeholder="Paste the post text…" aria-label="Post text" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <Button disabled={pending || post.trim().length < 40} onClick={() => start(async () => { setError(undefined); const r = await suggestComments(post, author); if (r.error) setError(r.error); else setIdeas(r.ideas); })}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Suggest comments
        </Button>
      </div>
      {ideas && (
        <ul className="mt-4 space-y-2">
          {ideas.comments.map((c) => (
            <li key={c.text} className="rounded-2xl bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3"><span className="text-xs font-medium capitalize text-wing">{c.style}</span><CopyButton text={c.text} /></div>
              <p className="mt-1">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ContentView({ posts }: { posts: ContentPost[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ContentPost | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [, start] = useTransition();

  const upcoming = posts.filter((p) => p.status === "idea" || p.status === "draft").sort((a, b) => (a.planned_for ?? "9").localeCompare(b.planned_for ?? "9"));
  const posted = posts.filter((p) => p.status === "posted");

  const run = (key: string, fn: () => Promise<{ error?: string } & Record<string, unknown>>, ok: (r: Record<string, unknown>) => string | null) => {
    setMessage(undefined);
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (r.error) setMessage({ tone: "error", text: r.error });
      else {
        const t = ok(r);
        if (t) setMessage({ tone: "ok", text: t });
      }
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Content"
        subtitle="Show up where hiring managers in your field spend time. Offerwing plans and drafts; you edit and post."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing("new")}><Plus className="size-4" /> Add idea</Button>
            <Button disabled={busy === "plan"} onClick={() => run("plan", createContentPlan, (r) => `Added ${r.added} post ideas for the next two weeks.`)}>
              {busy === "plan" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Plan 2 weeks
            </Button>
          </div>
        }
      />
      {message && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</p>}

      <div className="space-y-6">
        {upcoming.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-6" />} title="No posts planned" body="Plan two weeks of posts built around your expertise and target roles, or add your own idea." />
        ) : (
          <Card>
            <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-wing" /> Coming up</h2>
            <ul className="mt-2 divide-y divide-line">
              {upcoming.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="w-28 shrink-0 text-xs text-muted">{fmtDay(p.planned_for)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.hook}</p>
                    <p className="mt-0.5 text-xs text-muted">{[p.pillar, FORMAT_LABEL[p.format], p.status === "draft" ? "Draft ready" : "Idea"].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => run(p.id + "a", () => setPostStatus(p.id, "archived"), () => null)} aria-label={`Archive ${p.hook}`}><Archive className="size-3.5" /></Button>
                    {p.status === "idea" ? (
                      <Button className="px-3 py-1.5 text-xs" disabled={busy === p.id} onClick={() => run(p.id, () => draftPost(p.id), () => "Draft ready. Open it to edit and post.")}>
                        {busy === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Write draft
                      </Button>
                    ) : null}
                    <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setEditing(p)}><Pencil className="size-3.5" /> Open</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <CommentHelper />

        {posted.length > 0 && (
          <Card>
            <h2 className="font-semibold">Posted</h2>
            <ul className="mt-2 divide-y divide-line">
              {posted.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="flex-1 truncate">{p.hook}</span>
                  {p.posted_url && <a href={p.posted_url} target="_blank" rel="noreferrer" className="text-wing" aria-label="Open post"><ExternalLink className="size-4" /></a>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New post idea" : "Post"}>
        {editing !== null && <Editor key={editing === "new" ? "new" : editing.id} post={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
