/**
 * ESCAPE HATCH: prerender a React component that CANNOT be server-rendered.
 *
 * renderToStaticMarkup gives up on anything that needs a real DOM — React
 * portals (Radix Dialog/Tooltip/Popover/Select) and Recharts 3, which emits an
 * empty wrapper div under SSR. So instead of rendering to a string, mount the
 * component in a real headless Chrome ONCE at build time and serialise the DOM
 * it produced. The output is static markup either way; only the oven changes.
 *
 * No new npm dependency — this drives the Chrome already installed on the box.
 *
 * Run:  node proof/capture.mjs
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dir, "out");
mkdirSync(out, { recursive: true });

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* -- 1. bundle for the BROWSER this time (React runtime included, build-only) -- */
console.log("→ bundling for headless mount");
await esbuild.build({
  entryPoints: [resolve(__dir, "browser-app.jsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: resolve(out, "browser-bundle.js"),
  logLevel: "error",
});

writeFileSync(
  resolve(out, "capture-page.html"),
  `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head>
<body><div id="mount"></div><script>${readFileSync(resolve(out, "browser-bundle.js"), "utf8")}</script></body></html>`
);

/* -------- 2. mount in real Chrome, once, and serialise what it produced -------- */
console.log("→ mounting in headless Chrome");
const dom = execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    // Let React mount and Recharts lay out, then freeze. Virtual time makes this
    // deterministic — it is not a wall-clock sleep.
    "--virtual-time-budget=5000",
    "--dump-dom",
    `file://${resolve(out, "capture-page.html")}`,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
);

/* ------------------------------- 3. extract ------------------------------- */
const svg = /<svg[\s\S]*<\/svg>/.exec(dom)?.[0] ?? "";
writeFileSync(resolve(out, "captured.svg"), svg);

const paths = (svg.match(/<path/g) || []).length;
const rects = (svg.match(/<rect/g) || []).length;
console.log(
  `\n  captured ${svg.length}b of SVG · ${paths} <path> · ${rects} <rect> · React in output: ${
    /data-react|__REACT/.test(svg) ? "YES" : "no"
  }`
);
const d = /d="(M[^"]{0,120})/.exec(svg);
console.log(`  first path geometry: ${d ? d[1].slice(0, 80) : "NONE — capture failed"}`);
