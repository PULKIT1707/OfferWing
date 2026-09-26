import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Extracted } from "../lib/extract";
import { FriendlyError } from "../lib/errors";
import { People } from "./People";
import type { Lookup, Me } from "./types";
import { AppLink, Button, Card, CopyText, Notice, scoreClass, Spinner } from "./ui";

const CHANNEL: Record<string, string> = {
  referral: "Ask for a referral first",
  hiring_manager: "Message the hiring manager",
  easy_apply: "Easy Apply",
  company_site: "Apply on the company site",
};

export function JobView({ me, page, lookup, refresh }: { me: Me; page: Extracted; lookup: Lookup; refresh: () => Promise<Lookup | null> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const job = lookup.job;
  const match = lookup.match;
  const scoring = busy === "score" || match?.status === "running";

  // Poll while the server is scoring (Starter / Always-on).
  useEffect(() => {
    if (match?.status !== "running") return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [match?.status, refresh]);

  async function save() {
    if (!page.title || !page.company) return setError("Couldn't read the job title and company from this page. Scroll to the top of the posting and try again.");
    setBusy("save");
    setError(undefined);
    try {
      const r = await api<{ job: { id: string }; scoring: { error?: string } | null }>("/api/ext/jobs", {
        body: { url: page.url, title: page.title, company: page.company, location: page.location, description: page.description },
      });
      if (r.scoring?.error) setError(r.scoring.error);
      if (me.aiMode === "private" && page.description) {
        setBusy("score");
        const { scoreJobPrivately } = await import("../lib/private-scoring");
        await scoreJobPrivately({ id: r.job.id, title: page.title, company: page.company, location: page.location, description: page.description }, lookup.people.length);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof FriendlyError || e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(null);
  }

  const m = match?.status === "complete" ? match.result : null;
  return (
    <>
      <Card>
        <p className="eyebrow">Job</p>
        <h1 className="title">{job?.title ?? page.title ?? "Untitled job"}</h1>
        <p className="muted">{[job?.company ?? page.company, page.location].filter(Boolean).join(" · ")}</p>
        {lookup.isExcluded && <Notice tone="warn">{lookup.company} is on your companies-to-avoid list.</Notice>}
        {!page.description && !job?.hasDescription && <Notice tone="warn">Couldn&apos;t read the job description. Open the full posting, then analyze again.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="row">
          {!job || job.stage === "discovered" || job.stage === "dismissed" ? (
            <Button onClick={save} disabled={!!busy}>{busy ? <Spinner /> : null} Save &amp; score fit</Button>
          ) : !m && !scoring ? (
            <Button onClick={save} disabled={!!busy || !page.description}>Score fit</Button>
          ) : null}
          {job && <AppLink path={`/dashboard/jobs/${job.id}/kit`}>Application kit →</AppLink>}
        </div>
        {job && job.stage === "discovered" ? (
          <p className="muted small">In your Offerwing inbox. Save it to move it into your pipeline.</p>
        ) : job ? (
          <p className="muted small">Saved to your pipeline ({job.stage}).</p>
        ) : null}
        {job && (job.stage === "screen" || job.stage === "interview") && <AppLink path={`/dashboard/interviews/${job.id}`}>Interview prep →</AppLink>}
      </Card>

      {(scoring || busy === "save") && (
        <Card>
          <p className="muted">
            <Spinner /> {busy === "save" ? "Saving to your pipeline…" : me.aiMode === "private" ? "Scoring with your own key…" : "Scoring your fit…"}
          </p>
        </Card>
      )}
      {match?.status === "failed" && !scoring && <Notice tone="error">{match.error}</Notice>}

      {m && (
        <Card title="Fit">
          <div className="fit">
            <span className={scoreClass(m.fit_score)}>{m.fit_score}</span>
            <p>{m.summary}</p>
          </div>
          <p className="channel">{CHANNEL[m.recommended_channel]}: <span className="muted">{m.channel_reason}</span></p>
          {m.preference_conflicts.length > 0 && <Notice tone="warn">{m.preference_conflicts.join(" · ")}</Notice>}
          {m.gaps.length > 0 && (
            <>
              <p className="label">Gaps</p>
              <ul className="list">{m.gaps.slice(0, 4).map((g) => <li key={g.requirement}>{g.requirement} <span className="muted small">({g.importance === "must_have" ? "must-have" : "nice to have"})</span></li>)}</ul>
            </>
          )}
          {m.keywords_to_mirror.length > 0 && <div className="chips">{m.keywords_to_mirror.map((k) => <span key={k} className="chip">{k}</span>)}</div>}
        </Card>
      )}

      {lookup.screeningAnswers.length > 0 && (
        <Card title="Screening answers">
          <p className="muted small">From your application kit. Copy each into the application yourself.</p>
          {lookup.screeningAnswers.map((a) => (
            <div key={a.question} className="answer">
              <div className="answer-head">
                <p className="label">{a.question}</p>
                <CopyText text={a.answer} />
              </div>
              <p className="small">{a.answer}</p>
            </div>
          ))}
        </Card>
      )}

      <People people={lookup.people} company={lookup.company} jobId={job?.id ?? null} connectionsImported={me.connectionsImported} />
    </>
  );
}
