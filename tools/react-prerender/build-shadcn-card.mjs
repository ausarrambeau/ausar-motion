/**
 * shadcn/ui + Recharts → the `ugc-shadcn-card` HyperFrames block.
 *
 * WHY A BROWSER AND NOT renderToStaticMarkup
 * Measured, not assumed (see proof/):
 *   - shadcn's own markup (Card/Badge, cva + tailwind-merge)  → server-renders fine
 *   - Radix inline primitives                                 → render, but effects
 *     never run, so data-state is stuck at "indeterminate"
 *   - Radix portals (Dialog/Tooltip/Popover/Select)           → render EMPTY
 *   - Recharts 3.x                                            → renders an empty
 *     <div class="recharts-wrapper"> and NO svg (2.x does server-render)
 * Mounting once in a real headless Chrome fixes all four at the same time, so
 * that is the only path here. React runs at BUILD time and is thrown away; the
 * emitted block is static markup + one stylesheet + GSAP.
 *
 * Run:  npm run build:card
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { svgPathProperties } from "svg-path-properties";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dir, ".card-build");
const OUT = resolve(__dir, "../../blocks/ugc-shadcn-card/ugc-shadcn-card.html");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const DURATION = 5.5;
const CARD_LEFT = 70;
const CARD_TOP = 300;

mkdirSync(TMP, { recursive: true });

/* ------------------------------------------------- 1. bundle for the browser */
console.log("→ bundling shadcn + recharts for headless mount");
await esbuild.build({
  entryPoints: [resolve(__dir, "card-app.jsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx" },
  alias: { "@/lib/utils": resolve(__dir, "shadcn-src/lib/utils.ts") },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: resolve(TMP, "bundle.js"),
  logLevel: "error",
});

writeFileSync(
  resolve(TMP, "page.html"),
  `<!doctype html><html><head><meta charset="utf-8"></head>
<body><div id="mount"></div><script>${readFileSync(resolve(TMP, "bundle.js"), "utf8")}</script></body></html>`
);

/* --------------------------------- 2. mount once, serialise what React built */
console.log("→ mounting in headless Chrome");
const dom = execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    // Deliberately NO --user-data-dir: pointing Chrome at a fresh profile makes
    // it run first-run setup and hang forever instead of dumping.
    // Virtual time, not wall-clock: deterministic across machines.
    "--virtual-time-budget=6000",
    "--dump-dom",
    `file://${resolve(TMP, "page.html")}`,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
);

let markup = /<div id="mount">([\s\S]*?)<\/div>\s*<script/.exec(dom)?.[1] ?? "";
if (!markup.includes('data-slot="card"')) throw new Error("capture failed: no shadcn card in DOM");
if (!markup.includes("<svg")) throw new Error("capture failed: recharts produced no svg");

/* --------------------------------------------------------- 3. de-lint markup
   Two things React/Recharts emit that a seekable renderer cannot keep. */
const hadTransition = markup.includes("transition-all");
// Radix fills the bar by translating the indicator left; the parent clips it.
// That is intentional, so declare it or the layout checker flags it every frame.
markup = markup.replace(/(data-slot="progress-indicator")/, '$1 data-layout-allow-overflow');
markup = markup.replace(/\s*transition-all/g, ""); // GSAP must own progress fill
markup = markup
  .replace(/<div class="recharts-tooltip-wrapper[\s\S]*?<\/div>/g, "") // hover-only, dead weight
  .replace(/\s(?:tabindex|role|aria-[a-z-]+)="[^"]*"/g, ""); // interaction affordances

/* ⛔ THE ONE THAT SILENTLY EATS THE CHART.
   Recharts' <Surface> emits `<title></title><desc></desc>` for screen readers.
   HyperFrames compiles compositions with an HTML parser, where <title> is an
   RCDATA element — so everything after it is consumed as escaped TEXT, and the
   entire chart collapses into a single text node inside <title>. The file looks
   perfect on disk and renders fine opened directly in a browser; it is empty
   only in the render. Symptom is "GSAP target not found" for every SVG selector.
   Strip them — a video has no screen reader. */
const a11yTags = (markup.match(/<(?:title|desc)>/g) || []).length;
markup = markup.replace(/<(title|desc)>[\s\S]*?<\/\1>/g, "");

/* ------------------------ 4. measure the curve IN NODE, never at render time */
const curveD = /class="recharts-curve recharts-area-curve"[^>]*\bd="([^"]+)"/.exec(markup)?.[1]
  ?? /<path[^>]*class="[^"]*recharts-area-curve[^"]*"[^>]*d="([^"]+)"/.exec(markup)?.[1];
if (!curveD) throw new Error("could not find the area curve path to measure");
const pathLen = Math.ceil(new svgPathProperties(curveD).getTotalLength());

/* GSAP targets the recharts-* CLASSES, not injected ids. Recharts already puts a
   React useId on these paths, and a second id attribute is simply ignored — the
   first one wins, silently, so half the tweens would find nothing.

   Those generated ids look like `recharts-area-:r0:`. The colons make them
   require CSS escaping, which HyperFrames flags and which can take down a whole
   timeline. Rewrite them (and the url(#…) references that point at them) to a
   plain token. */
const unsafeIds = (markup.match(/:r[0-9a-z]+:/g) || []).length;
markup = markup.replace(/:r([0-9a-z]+):/g, "_r$1_");

/* --------------- 5. Tailwind v4 against the EMITTED markup, not the source ---
   cva + tailwind-merge decide the final class list at render time, so scanning
   the .tsx would compile classes that lost and miss the ones that won. */
console.log("→ compiling Tailwind v4 against the emitted markup");
writeFileSync(resolve(TMP, "scan.html"), markup);
// @source, not --content: the theme uses source(none), which makes --content inert.
writeFileSync(
  resolve(TMP, "input.css"),
  `@source "${resolve(TMP, "scan.html")}";\n` + readFileSync(resolve(__dir, "shadcn-theme.css"), "utf8")
);
execFileSync(
  resolve(__dir, "node_modules/.bin/tailwindcss"),
  ["--input", resolve(TMP, "input.css"), "--output", resolve(TMP, "styles.css"), "--minify"],
  { stdio: ["ignore", "ignore", "inherit"] }
);
let css = readFileSync(resolve(TMP, "styles.css"), "utf8").trim();

/* Tailwind's preflight writes `var(--default-font-family, -apple-system, …,
   "Apple Color Emoji", …)`. We define the variable, so that fallback list is
   dead code — but HyperFrames resolves every family it finds in the CSS TEXT
   and will happily embed 183 MB of Apple Color Emoji into the render. Drop it. */
const fontFallbacks = (css.match(/var\(--default-(?:mono-)?font-family,/g) || []).length;
css = css.replace(/var\((--default-(?:mono-)?font-family),[^)]*\)/g, "var($1)");

/* -------------------------------------------------------- 6. emit the block */
const block = `<!-- hyperframes-registry-item: ugc-shadcn-card -->
<!doctype html>
<html
  lang="en"
  data-composition-variables='[
    {"id":"title","type":"string","label":"Card title","default":"Pipeline"},
    {"id":"description","type":"string","label":"Card subtitle","default":"Trailing eight months"},
    {"id":"valueTo","type":"number","label":"Headline value","default":46250},
    {"id":"badge","type":"string","label":"Badge text","default":"+318%"},
    {"id":"progressTo","type":"number","label":"Progress %","default":68},
    {"id":"caption","type":"string","label":"Caption","default":"straight from your design system"},
    {"id":"accent","type":"color","label":"Accent","default":"#CD6E58"}
  ]'
>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <!--
      GENERATED FILE — do not hand-edit.
      Source: registry/tools/react-prerender/card-app.jsx
      Rebuild: cd registry/tools/react-prerender && npm run build:card

      The markup below came out of real shadcn/ui + Recharts, rendered by React
      in headless Chrome at build time. No React ships to the renderer.

      BAKED vs LIVE: text and number props below are live. The chart GEOMETRY is
      baked — changing the series means rebuilding this file, not setting a prop.
    -->
    <style>
${css}
    </style>
    <style>
      #root {
        position: absolute;
        inset: 0;
        font-family: "Inter", sans-serif;
        /* Recharts wrote these var() names into the SVG attributes, so the
           chart re-themes with the accent prop instead of being baked. */
        --accent: #cd6e58;
        --grid: #e6e3df;
        --muted: #8a8580;
      }
      #sc-wrap {
        position: absolute;
        left: ${CARD_LEFT}px;
        top: ${CARD_TOP}px;
        opacity: 0;
      }
      #sc-card {
        border: 1.5px solid #eceae6;
        box-shadow: 0 18px 48px rgba(17, 17, 17, 0.1);
      }
      #sc-caption {
        position: absolute;
        left: ${CARD_LEFT}px;
        top: ${CARD_TOP + 760}px;
        width: 940px;
        text-align: center;
        font-size: 30px;
        font-weight: 600;
        color: #6f6a64;
        opacity: 0;
      }
      /* svg-path-draw: dash length baked in Node — never measured at seek time. */
      .recharts-area-curve {
        stroke-dasharray: ${pathLen};
        stroke-dashoffset: ${pathLen};
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="ugc-shadcn-card"
      data-start="0"
      data-duration="${DURATION}"
      data-width="1080"
      data-height="1920"
    >
      <div id="sc-wrap" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="0">
${markup
  .split("\n")
  .map((l) => "        " + l)
  .join("\n")}
      </div>
      <div id="sc-caption" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="1">
        straight from your design system
      </div>
    </div>

    <script>
      (function () {
        window.__timelines = window.__timelines || {};
        const V = window.__variables || {};
        const root = document.getElementById("root");
        if (V.accent) root.style.setProperty("--accent", V.accent);

        const valueEl = document.getElementById("sc-value");
        const VALUE_TO = Number(V.valueTo ?? 46250);
        const PROGRESS_TO = Number(V.progressTo ?? 68);
        if (V.title) document.getElementById("sc-title").textContent = V.title;
        if (V.description) document.getElementById("sc-desc").textContent = V.description;
        if (V.badge) document.getElementById("sc-badge").textContent = V.badge;
        if (V.caption) document.getElementById("sc-caption").textContent = V.caption;

        const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
        const bar = document.getElementById("sc-progress").firstElementChild;

        const tl = gsap.timeline({ paused: true });

        // spring-pop-entrance
        gsap.set("#sc-wrap", { opacity: 1 });
        tl.fromTo(
          "#sc-wrap",
          { scale: 0.9, y: 54, opacity: 0 },
          { scale: 1, y: 0, opacity: 1, duration: 0.62, ease: "back.out(1.7)" },
          0,
        );

        // waterfall-entry on the header
        tl.fromTo(
          ["#sc-title", "#sc-desc"],
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.36, ease: "power3.out", stagger: 0.09 },
          0.3,
        );

        // dataviz-countup + counting-dynamic-scale
        const m = { v: 0 };
        tl.to(
          m,
          {
            v: VALUE_TO,
            duration: 1.25,
            ease: "power2.out",
            onUpdate: () => {
              valueEl.textContent = money(m.v);
            },
          },
          0.55,
        );
        tl.fromTo(
          "#sc-value",
          { scale: 0.86 },
          { scale: 1, duration: 0.5, ease: "back.out(2)" },
          0.55,
        );
        tl.fromTo(
          "#sc-badge",
          { scale: 0, rotate: -8 },
          { scale: 1, rotate: 0, duration: 0.44, ease: "back.out(2.6)" },
          1.15,
        );

        // stat-bars-and-fills — Radix sets the value with a transform, so drive
        // that transform rather than the width.
        tl.fromTo(
          bar,
          { xPercent: -100 },
          { xPercent: -(100 - PROGRESS_TO), duration: 0.8, ease: "power2.out" },
          1.0,
        );

        // svg-path-draw, then the area fill washes in behind it
        tl.to(".recharts-area-curve", { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" }, 1.35);
        tl.fromTo(".recharts-area-area", { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power1.out" }, 1.9);
        tl.fromTo(
          ".recharts-cartesian-axis-tick",
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: "power2.out", stagger: 0.055 },
          1.55,
        );

        gsap.set("#sc-caption", { opacity: 1 });
        tl.fromTo(
          "#sc-caption",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.34, ease: "power3.out" },
          3.5,
        );

        window.__timelines["ugc-shadcn-card"] = tl;
      })();
    </script>
  </body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, block);
rmSync(TMP, { recursive: true, force: true });

console.log(
  `\n  markup ${(markup.length / 1024).toFixed(1)} KB · CSS ${(css.length / 1024).toFixed(1)} KB` +
    ` · curve ${pathLen}px · transition-all stripped: ${hadTransition ? "yes" : "NOT FOUND"}` +
    ` · unsafe ids rewritten: ${unsafeIds} · svg a11y tags stripped: ${a11yTags} · font fallbacks pruned: ${fontFallbacks}`
);
console.log(`  → ${OUT}`);
