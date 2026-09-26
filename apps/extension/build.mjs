// Builds the extension into dist/. Load dist/ via chrome://extensions → Developer mode → Load unpacked.
// Config: OFFERWING_APP_URL (default http://localhost:3000); Supabase URL/key default to apps/web/.env.local.
import { build, context } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webEnvPath = join(here, "../web/.env.local");
const webEnv = existsSync(webEnvPath)
  ? Object.fromEntries(readFileSync(webEnvPath, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]))
  : {};

const APP_URL = (process.env.OFFERWING_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SUPABASE_URL = process.env.SUPABASE_URL ?? webEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? webEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase URL/key (set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or apps/web/.env.local)");

// Chrome match patterns don't take ports; "http://localhost/*" covers every port.
const pattern = (url) => {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
};

const dist = join(here, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(here, "static"), dist, { recursive: true });
writeFileSync(
  join(dist, "manifest.json"),
  readFileSync(join(here, "manifest.template.json"), "utf8").replaceAll("__APP_PATTERN__", pattern(APP_URL)).replaceAll("__SUPABASE_PATTERN__", pattern(SUPABASE_URL)),
);

const options = {
  entryPoints: { background: join(here, "src/background.ts"), sidepanel: join(here, "src/sidepanel/main.tsx") },
  outdir: dist,
  bundle: true,
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  format: "esm",
  target: "chrome120",
  jsx: "automatic",
  minify: !process.argv.includes("--watch"),
  sourcemap: process.argv.includes("--watch") ? "inline" : false,
  // Shared code from apps/web uses "@/..." imports; everything must use this package's single copy of zod.
  alias: { "@": join(here, "../web/src"), zod: join(here, "node_modules/zod") },
  define: {
    __APP_URL__: JSON.stringify(APP_URL),
    __SUPABASE_URL__: JSON.stringify(SUPABASE_URL),
    __SUPABASE_KEY__: JSON.stringify(SUPABASE_KEY),
    "process.env": "{}",
  },
  logLevel: "info",
};

if (process.argv.includes("--watch")) await (await context(options)).watch();
else await build(options);
console.log(`Built for ${APP_URL} → dist/`);
