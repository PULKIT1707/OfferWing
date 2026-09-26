import { People } from "./People";
import type { Lookup, Me } from "./types";
import { AppLink, Card, Notice, scoreClass } from "./ui";
import type { Extracted } from "../lib/extract";

// "Stripe, Inc." at the end of a sentence shouldn't produce "Inc..".
const noDot = (s: string | null) => (s ?? "").replace(/\.$/, "");

export function ProfileView({ me, page, lookup }: { me: Me; page: Extracted; lookup: Lookup }) {
  const c = lookup.connection;
  return (
    <>
      <Card>
        <p className="eyebrow">Profile</p>
        <h1 className="title">{c?.full_name ?? page.name ?? "This person"}</h1>
        <p className="muted">{c ? [c.position, c.company].filter(Boolean).join(" · ") : page.headline}</p>
        {!me.connectionsImported ? (
          <Notice>Import your LinkedIn data export to see your relationship with people. <AppLink path="/dashboard/network">Referral Scout</AppLink></Notice>
        ) : !c ? (
          <Notice>Not one of your imported 1st-degree connections.</Notice>
        ) : (
          <>
            <div className="fit">
              <span className={scoreClass(c.score)}>{c.score}</span>
              <p>Referral likelihood</p>
            </div>
            {c.reasons.length > 0 && <div className="chips">{c.reasons.map((r) => <span key={r} className="chip">{r}</span>)}</div>}
            {lookup.isTarget && <Notice>{noDot(c.company)} is one of your dream companies.</Notice>}
            {lookup.jobsAtCompany.length > 0 && <Notice>You have {lookup.jobsAtCompany.length} open {lookup.jobsAtCompany.length === 1 ? "job" : "jobs"} at {noDot(c.company)}.</Notice>}
          </>
        )}
      </Card>
      {c && <People people={lookup.people} company={c.company} jobId={lookup.jobsAtCompany[0]?.id ?? null} connectionsImported />}
    </>
  );
}

export function CompanyView({ me, page, lookup }: { me: Me; page: Extracted; lookup: Lookup }) {
  return (
    <>
      <Card>
        <p className="eyebrow">Company</p>
        <h1 className="title">{lookup.company ?? page.company ?? "This company"}</h1>
        {lookup.isTarget && <Notice>On your dream companies list.</Notice>}
        {lookup.isExcluded && <Notice tone="warn">On your companies-to-avoid list.</Notice>}
        {lookup.jobsAtCompany.length > 0 ? (
          <>
            <p className="label">In your pipeline</p>
            <ul className="list">
              {lookup.jobsAtCompany.map((j) => (
                <li key={j.id}>
                  {j.title} {j.fit_score != null && <span className={scoreClass(j.fit_score)}>{j.fit_score}</span>} <span className="muted small">{j.stage}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted small">No saved jobs here yet. Open one of their job posts and click Analyze to save it.</p>
        )}
      </Card>
      <People people={lookup.people} company={lookup.company} jobId={lookup.jobsAtCompany[0]?.id ?? null} connectionsImported={me.connectionsImported} />
    </>
  );
}
