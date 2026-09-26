import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { pageKind } from "@/lib/linkedin-urls";
import { api, ApiError } from "../lib/api";
import { APP_URL } from "../lib/config";
import { extractPage, type Extracted } from "../lib/extract";
import { supabase } from "../lib/supabase";
import { JobView } from "./JobView";
import { CompanyView, ProfileView } from "./OtherViews";
import { Settings } from "./Settings";
import type { Lookup, Me } from "./types";
import { Button, Card, Notice, Spinner } from "./ui";

function useActiveTab() {
  const [tab, setTab] = useState<{ id: number; url: string } | null>(null);
  useEffect(() => {
    const read = () =>
      chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab(t?.id != null ? { id: t.id, url: t.url ?? "" } : null));
    void read();
    const onActivated = () => void read();
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo, t: chrome.tabs.Tab) => {
      if (t.active && info.url) void read();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);
  return tab;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<"main" | "settings">("main");
  const [page, setPage] = useState<Extracted | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const tab = useActiveTab();
  const kind = tab ? pageKind(tab.url) : "other";
  const onLinkedIn = !!tab && /^https:\/\/([a-z]+\.)?linkedin\.com\//.test(tab.url);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/ext/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await supabase.auth.signOut({ scope: "local" });
      else setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (session) void loadMe();
  }, [session, loadMe]);

  // A different page means a fresh analysis.
  const [lastUrl, setLastUrl] = useState(tab?.url);
  if (tab?.url !== lastUrl) {
    setLastUrl(tab?.url);
    setPage(null);
    setLookup(null);
    setError(undefined);
  }

  const refresh = useCallback(async () => {
    if (!page || kind === "other") return null;
    const l = await api<Lookup>("/api/ext/lookup", { body: { kind, url: page.url, company: page.company } });
    setLookup(l);
    return l;
  }, [page, kind]);

  async function analyze() {
    if (!tab) return;
    setBusy(true);
    setError(undefined);
    try {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
      const extracted = res?.result as Extracted | undefined;
      if (!extracted) throw new Error("Couldn't read this page. Reload it and try again.");
      setPage(extracted);
      setLookup(await api<Lookup>("/api/ext/lookup", { body: { kind, url: extracted.url, company: extracted.company } }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (session === undefined) return <div className="center"><Spinner /></div>;

  if (!session) {
    return (
      <div className="signed-out">
        <div className="logo">Offerwing</div>
        <h1 className="title">Your job-search copilot on LinkedIn</h1>
        <p className="muted">See your fit, who can refer you and what to do next, right beside the page you&apos;re on.</p>
        <Button onClick={() => chrome.tabs.create({ url: `${APP_URL}/extension/connect` })}>Connect your Offerwing account</Button>
        <p className="muted small">Reads a page only when you click Analyze. Never clicks, sends or applies for you.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <header className="top">
        <span className="logo">Offerwing</span>
        <button className="icon" onClick={() => setView(view === "settings" ? "main" : "settings")} aria-label="Settings">⚙</button>
      </header>

      {view === "settings" && me ? (
        <Settings me={me} onChanged={() => void loadMe()} onBack={() => setView("main")} />
      ) : !me ? (
        error ? <Notice tone="error">{error}</Notice> : <div className="center"><Spinner /></div>
      ) : !me.onboarded ? (
        <Card><p>Finish setting up Offerwing first.</p><a className="link" href={`${APP_URL}/onboarding`} target="_blank" rel="noreferrer">Continue setup →</a></Card>
      ) : !onLinkedIn || kind === "other" ? (
        <Card>
          <p className="title-sm">Open a LinkedIn job, profile or company page</p>
          <p className="muted small">Then click Analyze to see your fit, who you know there and your next step.</p>
        </Card>
      ) : !lookup ? (
        <Card>
          <p className="title-sm">{kind === "job" ? "Job post detected" : kind === "profile" ? "Profile detected" : "Company page detected"}</p>
          <p className="muted small">Offerwing reads this page only when you click.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <Button onClick={analyze} disabled={busy}>{busy && <Spinner />} Analyze this page</Button>
        </Card>
      ) : kind === "job" && page ? (
        <JobView me={me} page={page} lookup={lookup} refresh={refresh} />
      ) : kind === "profile" && page ? (
        <ProfileView me={me} page={page} lookup={lookup} />
      ) : page ? (
        <CompanyView me={me} page={page} lookup={lookup} />
      ) : null}
    </div>
  );
}
