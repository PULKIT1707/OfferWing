import { useEffect, useState } from "react";
import type { Provider } from "@/lib/onboarding";
import { PROVIDERS } from "@/lib/onboarding";
import { FriendlyError } from "../lib/errors";
import { getPrivateKey, removePrivateKey, setPrivateKey, type PrivateKey } from "../lib/private-key";
import { supabase } from "../lib/supabase";
import type { Me } from "./types";
import { AppLink, Button, Card, Notice, Spinner } from "./ui";

export function Settings({ me, onChanged, onBack }: { me: Me; onChanged: () => void; onBack: () => void }) {
  const [saved, setSaved] = useState<PrivateKey | null | undefined>(undefined);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string }>();

  useEffect(() => {
    void getPrivateKey().then((k) => {
      setSaved(k);
      if (k) setProvider(k.provider);
    });
  }, []);

  async function saveKey() {
    setBusy(true);
    setMessage(undefined);
    try {
      const key = { provider, apiKey: apiKey.trim() };
      const { verifyKey } = await import("../lib/llm");
      await verifyKey(key);
      await setPrivateKey(key);
      // Switch the account to Private mode so agents know the key lives here.
      const { error } = await supabase.rpc("set_ai_mode", { p_mode: "private", p_provider: provider });
      if (error) throw new FriendlyError("Saved the key, but couldn't switch your account to Private mode.");
      setSaved(key);
      setApiKey("");
      setMessage({ tone: "info", text: "Key verified and saved on this device. Your account is now in Private mode." });
      onChanged();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
    setBusy(false);
  }

  async function removeKey() {
    await removePrivateKey();
    await supabase.rpc("set_ai_mode", { p_mode: "starter", p_provider: null });
    setSaved(null);
    setMessage({ tone: "info", text: "Key removed from this device. Your account is back on Starter." });
    onChanged();
  }

  return (
    <>
      <button className="back" onClick={onBack}>← Back</button>
      <Card title="Account">
        <p>{me.name ?? "Signed in"}</p>
        <p className="muted small">AI mode: {me.aiMode === "private" ? "Private (key on this device)" : me.aiMode === "cloud" ? "Always-on" : "Starter"}</p>
        <div className="row">
          <AppLink path="/dashboard">Open Offerwing →</AppLink>
          <Button kind="ghost" onClick={async () => { await supabase.auth.signOut({ scope: "local" }); onChanged(); }}>Disconnect</Button>
        </div>
      </Card>

      <Card title="Private mode key">
        <p className="muted small">Your key stays in this browser&apos;s extension storage. It goes only to your AI provider, never to Offerwing.</p>
        {saved === undefined ? (
          <Spinner />
        ) : saved ? (
          <>
            <p>
              {PROVIDERS.find(([id]) => id === saved.provider)?.[1]} key ending …{saved.apiKey.slice(-4)}
            </p>
            <Button kind="ghost" onClick={removeKey}>Remove key</Button>
          </>
        ) : (
          <>
            <div className="providers">
              {PROVIDERS.map(([id, label]) => (
                <button key={id} className={`pill ${provider === id ? "on" : ""}`} onClick={() => setProvider(id)} aria-pressed={provider === id}>
                  {label}
                </button>
              ))}
            </div>
            <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={PROVIDERS.find(([id]) => id === provider)?.[2]} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <p className="muted small">
              Create a separate key with a monthly spend limit:{" "}
              <a className="link" href={PROVIDERS.find(([id]) => id === provider)?.[3]} target="_blank" rel="noreferrer">get a key</a>
            </p>
            <Button onClick={saveKey} disabled={busy || apiKey.trim().length < 20}>{busy && <Spinner />} Verify &amp; save</Button>
          </>
        )}
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </Card>
    </>
  );
}
