/**
 * Shared React → HyperFrames-block pipeline.
 *
 * Every trap below was found by rendering, not by reading docs, and every one of
 * them produces a file that is correct on disk and pixel-perfect when opened
 * directly in a browser. They live here so the block builders can't drift apart
 * on them.
 *
 * The flow: bundle the component for the browser → mount it ONCE in headless
 * Chrome → serialise the DOM React produced → de-lint → compile Tailwind against
 * the emitted markup. React runs at build time and is discarded.
 *
 * Why a browser rather than renderToStaticMarkup (measured, see proof/):
 *   shadcn markup (cva + tailwind-merge)   server-renders
 *   Radix inline primitives                render, but effects never run
 *   Radix portals (Dialog/Tooltip/…)       render as an EMPTY STRING
 *   Recharts 2.x                           server-renders
 *   Recharts 3.x                           empty wrapper div, no <svg>
 * None of the failing rows throw — they return nothing. A build that only
 * catches exceptions reports success and ships a blank scene.
 */
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Bundle `entry`, mount it in headless Chrome, and return the DOM it produced.
 *
 * @param {object}   o
 * @param {string}   o.dir      tool root (where shadcn-src / node_modules live)
 * @param {string}   o.tmp      scratch dir for this build
 * @param {string}   o.entry    absolute path to the browser entry (.jsx)
 * @param {string[]} o.expect   substrings the captured markup MUST contain
 * @param {"mount"|"body"} o.capture
 *        "mount" takes #mount's innerHTML — right for ordinary components.
 *        "body"  takes the whole body minus the bundle script. Required for
 *        anything PORTALLED: shadcn's DialogContent renders its own DialogPortal
 *        with no `container` escape hatch, so the overlay and content mount as
 *        siblings of #mount and a "mount" capture returns an empty div. That
 *        looks like "the dialog didn't render" when it rendered perfectly.
 * @returns {Promise<string>}   the captured markup
 */
export async function prerender({ dir, tmp, entry, expect = [], capture = "mount" }) {
  mkdirSync(tmp, { recursive: true });

  console.log("→ bundling for headless mount");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx" },
    // shadcn source imports itself through two aliases; map both.
    alias: {
      "@/lib/utils": resolve(dir, "shadcn-src/lib/utils.ts"),
      "@/registry/new-york-v4/ui/button": resolve(dir, "shadcn-src/ui/button.tsx"),
    },
    define: { "process.env.NODE_ENV": '"production"' },
    outfile: resolve(tmp, "bundle.js"),
    logLevel: "error",
  });

  writeFileSync(
    resolve(tmp, "page.html"),
    `<!doctype html><html><head><meta charset="utf-8"></head>
<body><div id="mount"></div><script>${readFileSync(resolve(tmp, "bundle.js"), "utf8")}</script></body></html>`
  );

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
      `file://${resolve(tmp, "page.html")}`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
  );

  let markup;
  if (capture === "body") {
    markup = (/<body[^>]*>([\s\S]*)<\/body>/.exec(dom)?.[1] ?? "")
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<div id="mount"><\/div>/, "") // empty once the portal moved out
      .trim();
  } else {
    markup = /<div id="mount">([\s\S]*?)<\/div>\s*<script/.exec(dom)?.[1] ?? "";
  }

  // Assert on real content rather than trusting the capture — an empty result is
  // the normal failure here, and an empty string throws nothing downstream.
  for (const needle of expect) {
    if (!markup.includes(needle)) {
      throw new Error(`capture failed: "${needle}" missing from the mounted DOM`);
    }
  }
  return markup;
}

/**
 * Transforms every prerendered block needs. Returns { markup, stats }.
 */
export function delint(markup) {
  const stats = {};

  /* ⛔ THE ONE THAT SILENTLY EATS AN SVG.
     HyperFrames compiles with an HTML parser, where <title> is an RCDATA
     element — everything after it is consumed as escaped TEXT and the whole
     SVG collapses into one text node. Recharts emits <title></title><desc></desc>
     for screen readers; lucide icons emit <title> too. The symptom is
     "GSAP target not found" for every SVG selector. A video has no screen
     reader, so strip them. */
  stats.a11yTags = (markup.match(/<(?:title|desc)>/g) || []).length;
  markup = markup.replace(/<(title|desc)>[\s\S]*?<\/\1>/g, "");

  /* React useId values look like `:r0:`. The colons require CSS escaping, which
     HyperFrames flags and which can take down a whole timeline. Rewrite the ids
     and the url(#…) references pointing at them in one pass. */
  stats.unsafeIds = (markup.match(/:r[0-9a-z]+:/g) || []).length;
  markup = markup.replace(/:r([0-9a-z]+):/g, "_r$1_");

  /* A seekable runtime must own every state change. CSS transitions and
     enter/exit animations fight the timeline and never resolve correctly under
     a non-linear seek. shadcn ships them on Progress, Badge, Button and Dialog.

     ⚠ Strip the WHOLE class token, variant prefix included. Matching only the
     utility leaves "data-[state=closed]:" dangling — a class name ending in a
     colon, which is not a valid selector. Tailwind then emits a malformed rule
     and neighbouring utilities stop applying: this is what silently killed p-14
     on the dialog, which presented as "the buttons overflow the padding" when
     the padding had simply never rendered. */
  const TRANSITION_TOKEN =
    /(?:^|\s)(?:[a-zA-Z0-9_-]+(?:\[[^\]\s]*\])?:)*(?:transition|animate|duration|ease|fade|zoom|slide)-[^\s"']*/g;
  stats.transitions = (markup.match(TRANSITION_TOKEN) || []).length;
  markup = markup.replace(TRANSITION_TOKEN, "");

  /* Radix positions overlays and dialog content with `position: fixed`. Inside a
     composition that is a trap: as soon as GSAP puts a transform on any ancestor,
     fixed resolves against that ancestor instead of the viewport and the element
     jumps. The block root is inset:0 at full canvas size, so absolute is
     equivalent and immune. */
  stats.fixedPositions = (markup.match(/position:\s*fixed/g) || []).length;
  markup = markup.replace(/position:\s*fixed/g, "position: absolute");

  /* Interaction affordances that cost bytes and mean nothing in a video. */
  markup = markup.replace(/\s(?:tabindex|role|aria-[a-z-]+)="[^"]*"/g, "");

  return { markup, stats };
}

/**
 * Compile Tailwind v4 against the EMITTED markup, not the source.
 * cva + tailwind-merge decide the winning class list at render time, so scanning
 * the .tsx compiles classes that lost and misses the ones that won.
 */
export function compileTailwind({ dir, tmp, markup }) {
  console.log("→ compiling Tailwind v4 against the emitted markup");
  writeFileSync(resolve(tmp, "scan.html"), markup);

  /* ⛔ shadcn-theme.css uses `source(none)`, which pins auto-detection so the
     output can't drift with neighbouring files — but it ALSO makes the CLI's
     --content flag inert, emitting base styles and ZERO utilities. The @source
     line below is what actually feeds the compiler. Getting this wrong renders
     as unstyled components, not as an error. */
  writeFileSync(
    resolve(tmp, "input.css"),
    `@source "${resolve(tmp, "scan.html")}";\n` +
      readFileSync(resolve(dir, "shadcn-theme.css"), "utf8")
  );
  execFileSync(
    resolve(dir, "node_modules/.bin/tailwindcss"),
    ["--input", resolve(tmp, "input.css"), "--output", resolve(tmp, "styles.css"), "--minify"],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  let css = readFileSync(resolve(tmp, "styles.css"), "utf8").trim();

  /* Tailwind's preflight writes `var(--default-font-family, -apple-system, …,
     "Apple Color Emoji", …)`. We define the variable, so the fallback list is
     dead code — but HyperFrames resolves every family it finds in the CSS TEXT
     and will embed ~183 MB of Apple Color Emoji into the render. Drop it. */
  const fontFallbacks = (css.match(/var\(--default-(?:mono-)?font-family,/g) || []).length;
  css = css.replace(/var\((--default-(?:mono-)?font-family),[^)]*\)/g, "var($1)");

  /* ⛔ CSS @layer DOES NOT SURVIVE THE RENDERER — and this one is brutal, because
     it fails per-property rather than all at once.

     Measured on a real block: an unlayered `padding: calc(var(--spacing) * 10)`
     applies (40px), while the identical rule inside `@layer utilities` computes
     to 0px — and so does a layered `padding-right: 40px`. Layered rules simply
     lose. Tailwind puts its preflight reset in `@layer base` and every utility in
     `@layer utilities`, so the reset wins and each utility that preflight zeroes
     is silently dead: padding, margin, border-width. Colours, radius, flex and
     gap survive, because preflight never resets those.

     The result LOOKS plausible — a card whose text sits flush to its edge reads
     as a design choice, not a bug — which is why it shipped once before it was
     caught. Flatten the wrappers so everything is unlayered; Tailwind already
     emits theme → base → components → utilities in that order, so source order
     gives utilities the win. */
  const layersBefore = (css.match(/@layer[^{;]*\{/g) || []).length;
  css = css.replace(/@layer[^{};]*;/g, ""); // layer-order statements
  for (let pass = 0; pass < 12 && /@layer[^{;]*\{/.test(css); pass++) {
    const at = css.search(/@layer[^{;]*\{/);
    const open = css.indexOf("{", at);
    let depth = 0,
      end = open;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      else if (css[end] === "}" && --depth === 0) break;
    }
    css = css.slice(0, at) + css.slice(open + 1, end) + css.slice(end + 1);
  }
  if (/@layer[^{;]*\{/.test(css)) throw new Error("failed to flatten all @layer blocks");

  return { css, fontFallbacks, layersFlattened: layersBefore };
}

/** Props accessor every block must use. There is no window.__variables. */
export const VARIABLES_PREAMBLE = `// Props: declared on <html>, overridable per mount via data-variable-values.
        // ⚠ The accessor is window.__hyperframes.getVariables(). Getting it wrong
        // fails SILENTLY: V is {}, every prop falls through to its default, lint
        // and check stay clean, and the render looks right because the defaults
        // ARE the design. The only tell is that an override does nothing.
        const V =
          (window.__hyperframes && window.__hyperframes.getVariables
            ? window.__hyperframes.getVariables()
            : null) || {};`;
