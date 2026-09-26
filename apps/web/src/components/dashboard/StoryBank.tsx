"use client";

import { BookOpen, ChevronDown, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteStory, extractStories, saveStory } from "@/app/dashboard/interviews/actions";
import { COMPETENCIES, type Story } from "@/lib/agents/interviews";
import { inputClass } from "@/components/onboarding/fields";
import { Button, Card, label, Modal } from "./ui";

function StoryForm({ story, onDone }: { story?: Story; onDone: () => void }) {
  const [v, setV] = useState({
    title: story?.title ?? "",
    situation: story?.situation ?? "",
    task: story?.task ?? "",
    action: story?.action ?? "",
    result: story?.result ?? "",
    competencies: story?.competencies ?? [],
  });
  const set = (p: Partial<typeof v>) => setV((prev) => ({ ...prev, ...p }));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveStory(story?.id ?? null, v);
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div>
        <label className={label} htmlFor="s-title">Title</label>
        <input id="s-title" className={inputClass} value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="Rebuilt onboarding under a tight deadline" />
      </div>
      {(["situation", "task", "action", "result"] as const).map((k) => (
        <div key={k}>
          <label className={label} htmlFor={`s-${k}`}>{k[0].toUpperCase() + k.slice(1)}</label>
          <textarea id={`s-${k}`} rows={2} className={inputClass} value={v[k]} onChange={(e) => set({ [k]: e.target.value })} />
        </div>
      ))}
      <div>
        <p className={label}>Shows</p>
        <div className="flex flex-wrap gap-1.5">
          {COMPETENCIES.map((c) => {
            const on = v.competencies.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => set({ competencies: on ? v.competencies.filter((x) => x !== c) : [...v.competencies, c] })} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-wing bg-wing text-white" : "border-line"}`}>
                {c}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save story</Button>
      </div>
    </form>
  );
}

export function StoryBank({ stories, hasDocuments }: { stories: Story[]; hasDocuments: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Story | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const [pending, start] = useTransition();

  const extract = () => {
    if (stories.some((s) => s.source === "extracted") && !confirm("Rebuild your extracted stories? Stories you wrote or edited stay.")) return;
    setMessage(undefined);
    start(async () => {
      const r = await extractStories();
      setMessage(r.error ? { tone: "error", text: r.error } : { tone: "ok", text: `Added ${r.added} stories from your documents. Review each one and fill in any [placeholders].` });
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><BookOpen className="size-4 text-wing" /> Story bank</h2>
          <p className="mt-1 text-sm text-muted">Your STAR stories. Prep packs match interview questions to them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setEditing("new")}><Plus className="size-3.5" /> Add</Button>
          <Button className="px-3 py-2 text-xs" onClick={extract} disabled={pending || !hasDocuments} title={hasDocuments ? undefined : "Upload your resume first"}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {stories.length ? "Rebuild from resume" : "Build from my resume"}
          </Button>
        </div>
      </div>
      {message && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</p>}
      {stories.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{hasDocuments ? "Build your story bank from your resume, or add stories yourself." : "Upload your resume in Settings, then build your story bank from it."}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {stories.map((s) => (
            <li key={s.id} className="py-3">
              <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-3 text-left" aria-expanded={open === s.id}>
                <span className="flex-1 font-medium">{s.title}</span>
                <span className="hidden gap-1 sm:flex">{s.competencies.slice(0, 3).map((c) => <span key={c} className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">{c}</span>)}</span>
                <ChevronDown className={`size-4 text-muted transition-transform ${open === s.id ? "rotate-180" : ""}`} />
              </button>
              {open === s.id && (
                <div className="mt-3 space-y-2 rounded-2xl bg-card p-4 text-sm">
                  {(["situation", "task", "action", "result"] as const).map((k) => s[k] && (
                    <p key={k}><span className="font-semibold capitalize">{k}: </span>{s[k]}</p>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing(s)}><Pencil className="size-3.5" /> Edit</Button>
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => confirm(`Delete "${s.title}"?`) && start(async () => { await deleteStory(s.id); router.refresh(); })}><Trash2 className="size-3.5" /> Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a story" : "Edit story"}>
        {editing !== null && <StoryForm key={editing === "new" ? "new" : editing.id} story={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </Card>
  );
}
