# Offerwing browser extension

Chrome (Manifest V3) side panel: open a LinkedIn job, profile or company page, click the Offerwing icon, then **Analyze this page**.
It reads the page only on that click, and never clicks, sends, applies or posts on LinkedIn.

## Build and load

```bash
npm install
npm run build          # or: npm run watch
```

Then in Chrome: `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → select `apps/extension/dist`.
Finally open `http://localhost:3000/extension/connect` (logged in to Offerwing) and click **Connect extension**.

- `OFFERWING_APP_URL` sets the Offerwing site the extension talks to (default `http://localhost:3000`).
- Supabase URL and publishable key are read from `apps/web/.env.local` (or `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`).

## Extension ID

The `key` in `manifest.template.json` pins the ID to `mgoonaiikahlemfjhcdgpdgjmkjjbmbc` on every machine. The web app only hands a
session to that ID (`NEXT_PUBLIC_EXTENSION_ID`). The matching private key (`extension-key.pem`) is git-ignored; keep it safe, since it's
only needed to package a `.crx`.

## Private mode

With Private mode, the user's AI key is stored only in `chrome.storage.local` and AI calls go straight from the side panel to the
provider (Anthropic, OpenAI or Gemini). Offerwing's servers supply the candidate context and store the result, never the key.
