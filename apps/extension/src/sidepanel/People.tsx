import { useState } from "react";
import { api } from "../lib/api";
import type { Person } from "./types";
import { AppLink, Button, Card } from "./ui";

function PersonRow({ p, jobId }: { p: Person; jobId: string | null }) {
  const [status, setStatus] = useState(p.listStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const add = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ referral_status: string }>("/api/ext/contacts", { body: { connectionId: p.id, jobId } });
      setStatus(r.referral_status);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="person">
      <div className="person-main">
        <p className="person-name">
          {p.profile_url ? (
            <a href={p.profile_url} target="_blank" rel="noreferrer">{p.full_name}</a>
          ) : (
            p.full_name
          )}
          <span className="badge">{p.score}</span>
        </p>
        <p className="muted small">{p.position}</p>
        {p.reasons.length > 0 && <div className="chips">{p.reasons.map((r) => <span key={r} className="chip">{r}</span>)}</div>}
        {error && <p className="error small">{error}</p>}
      </div>
      {status ? <span className="on-list">✓ {status === "to_ask" ? "On your list" : status.replace("_", " ")}</span> : <Button kind="ghost" disabled={busy} onClick={add}>Add</Button>}
    </div>
  );
}

export function People({ people, company, jobId, connectionsImported }: { people: Person[]; company: string | null; jobId: string | null; connectionsImported: boolean }) {
  if (!company) return null;
  return (
    <Card title={`People you know at ${company}`}>
      {!connectionsImported ? (
        <p className="muted small">
          Import your LinkedIn data export to see who can refer you. <AppLink path="/dashboard/network">Open Referral Scout</AppLink>
        </p>
      ) : people.length === 0 ? (
        <p className="muted small">No 1st-degree connections here. Try the company&apos;s People tab for alumni and ex-colleagues.</p>
      ) : (
        <>
          {people.slice(0, 5).map((p) => <PersonRow key={p.id} p={p} jobId={jobId} />)}
          <p className="muted small">
            Draft a referral ask in <AppLink path="/dashboard/network">Referral Scout</AppLink>.
          </p>
        </>
      )}
    </Card>
  );
}
