import { APP_URL } from "./lib/config";
import { supabase } from "./lib/supabase";

// Clicking the toolbar icon opens the side panel.
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// The Offerwing "Connect extension" page hands over the user's session. Only that origin can
// message us (manifest externally_connectable), and we double-check the sender here.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const fromApp = sender.origin === new URL(APP_URL).origin;
  if (!fromApp || message?.type !== "offerwing:connect" || typeof message.accessToken !== "string" || typeof message.refreshToken !== "string") {
    sendResponse({ ok: false });
    return;
  }
  supabase.auth
    .setSession({ access_token: message.accessToken, refresh_token: message.refreshToken })
    .then(({ error }) => sendResponse({ ok: !error }))
    .catch(() => sendResponse({ ok: false }));
  return true; // respond asynchronously
});
