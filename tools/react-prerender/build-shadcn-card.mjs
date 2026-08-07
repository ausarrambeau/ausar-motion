/**
 * shadcn/ui + Recharts → the `ugc-shadcn-card` block.
 *
 * The generic pipeline (browser mount, de-lint, Tailwind) and every render-only
 * trap it guards against live in ./prerender-lib.mjs. Only card-specific work is
 * here.
 *
 * Run:  npm run build:card
 */
import { svgPathProperties } from "svg-path-properties";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prerender, delint, compileTailwind, VARIABLES_PREAMBLE } from "./prerender-lib.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dir, ".card-build");
const OUT = resolve(__dir, "../../blocks/ugc-shadcn-card/ugc-shadcn-card.html");

const DURATION = 5.5;
const CARD_LEFT = 70;
const CARD_TOP = 452;   // = ugc-dashboard's panel top, so full-bleed scenes align

let markup = await prerender({
  dir: __dir,
  tmp: TMP,
  entry: resolve(__dir, "card-app.jsx"),
  expect: ['data-slot="card"', 'data-slot="progress"', "<svg", "recharts-area-curve"],
});

/* -------------------------------------------------- card-specific de-linting */
// Radix fills the bar by translating the indicator left; the parent clips it.
// Intentional, so declare it or the layout checker flags it on every frame.
markup = markup.replace(/(data-slot="progress-indicator")/, '$1 data-layout-allow-overflow');
// Recharts' tooltip layer is hover-only — dead weight in a video.
markup = markup.replace(/<div class="recharts-tooltip-wrapper[\s\S]*?<\/div>/g, "");

/* Measure the curve IN NODE. Never call getTotalLength() in a timeline callback:
   the renderer seeks non-linearly, so measured geometry becomes seek-order
   dependent. The dash length ships as a baked constant. */
const curveD = /class="recharts-curve recharts-area-curve"[^>]*\bd="([^"]+)"/.exec(markup)?.[1];
if (!curveD) throw new Error("could not find the area curve path to measure");
const pathLen = Math.ceil(new svgPathProperties(curveD).getTotalLength());

const dl = delint(markup);
markup = dl.markup;
const { css, fontFallbacks } = compileTailwind({ dir: __dir, tmp: TMP, markup });

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
      /* The pack's full-bleed caption treatment — identical to .bcap in
         ugc-dashboard, so consecutive full-bleed scenes read as one format.
         The paper-coloured stroke under the fill is what keeps it legible
         wherever it lands. */
      #sc-caption {
        position: absolute;
        left: 0;
        top: 1180px;
        width: 1080px;
        text-align: center;
        font-family: "Playfair Display", serif;
        font-weight: 900;
        font-style: italic;
        font-size: 78px;
        text-transform: uppercase;
        color: #111111;
        -webkit-text-stroke: 11px #fdfdfd;
        paint-order: stroke fill;
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
        ${VARIABLES_PREAMBLE}
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
    ` · curve ${pathLen}px · a11y ${dl.stats.a11yTags} · unsafe ids ${dl.stats.unsafeIds}` +
    ` · transition classes ${dl.stats.transitions} · fixed→abs ${dl.stats.fixedPositions}` +
    ` · font fallbacks ${fontFallbacks}`
);
console.log(`  → ${OUT}`);
