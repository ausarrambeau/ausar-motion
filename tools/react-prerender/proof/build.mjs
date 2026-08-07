/**
 * shadcn/ui + Recharts -> static HTML/CSS, at build time.
 *
 *   1. esbuild transpiles the .tsx shadcn sources and bundles them with React
 *   2. the bundle runs in Node and emits static markup (no React ships onward)
 *   3. the Tailwind v4 CLI scans that markup and emits only the CSS it uses
 *   4. the two are stitched into one self-contained file
 *
 * Run:  node proof/build.mjs
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dir, "out");
mkdirSync(out, { recursive: true });

/* -- 1/2. transpile + bundle. "@/lib/utils" is shadcn's own alias, remapped. -- */
console.log("→ bundling shadcn sources (esbuild)");
await esbuild.build({
  entryPoints: [resolve(__dir, "app.jsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx" },
  alias: { "@/lib/utils": resolve(__dir, "../shadcn-src/lib/utils.ts") },
  // react-dom/server is CJS and calls require("stream"); an ESM bundle has no
  // `require`, so hand it a real one. esbuild's shim defers to it when present.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  outfile: resolve(out, ".bundle.mjs"),
  logLevel: "error",
});

console.log("→ prerendering to static markup (Node, no browser)");
await import(resolve(out, ".bundle.mjs"));

/* ------- 3. Tailwind v4 compiles against the EMITTED markup, not the JSX ------
   This matters: the class strings are produced by cva + tailwind-merge at
   render time, so scanning the source would miss the ones that actually win. */
console.log("→ compiling Tailwind v4 against the emitted markup");
writeFileSync(
  resolve(out, "input.css"),
  `@source "${resolve(out, "markup.html")}";\n` +
    readFileSync(resolve(__dir, "../shadcn-theme.css"), "utf8")
);
execFileSync(
  resolve(__dir, "../node_modules/.bin/tailwindcss"),
  ["--input", resolve(out, "input.css"), "--output", resolve(out, "styles.css"), "--minify"],
  { stdio: ["ignore", "ignore", "inherit"] }
);

/* ------------------------------- 4. stitch ------------------------------- */
const markup = readFileSync(resolve(out, "markup.html"), "utf8");
const css = readFileSync(resolve(out, "styles.css"), "utf8");
writeFileSync(
  resolve(out, "standalone.html"),
  `<!doctype html>
<html><head><meta charset="utf-8"><style>${css}</style>
<style>body{margin:0;background:#FDFDFD;font-family:Inter,system-ui,sans-serif}</style>
</head><body>${markup}</body></html>`
);

const cssKb = (Buffer.byteLength(css) / 1024).toFixed(1);
const report = JSON.parse(readFileSync(resolve(out, "report.json"), "utf8"));
const pass = report.filter((r) => r.ok).length;
console.log(`\n  ${pass}/${report.length} prerendered · CSS ${cssKb} KB · React in output: ${/data-reactroot|__NEXT/.test(markup) ? "YES" : "no"}`);
console.log(`  → ${resolve(out, "standalone.html")}`);
