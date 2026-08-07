/**
 * shadcn/ui Dialog → the `ugc-shadcn-dialog` block.
 *
 * This is the case that defeats renderToStaticMarkup outright: a Radix portal
 * server-renders to an EMPTY STRING (measured in proof/). Mounting in a real
 * browser fixes it, but the portal then lands in document.body rather than in
 * #mount — hence capture: "body".
 *
 * Run:  npm run build:dialog
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prerender, delint, compileTailwind, VARIABLES_PREAMBLE } from "./prerender-lib.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dir, ".dialog-build");
const OUT = resolve(__dir, "../../blocks/ugc-shadcn-dialog/ugc-shadcn-dialog.html");

const DURATION = 5;

let markup = await prerender({
  dir: __dir,
  tmp: TMP,
  entry: resolve(__dir, "dialog-app.jsx"),
  capture: "body",
  expect: ['data-slot="dialog-content"', 'data-slot="dialog-overlay"', 'data-slot="badge"', "Approve"],
});

/* ------------------------------------------------ dialog-specific de-linting */

/* Radix centres the dialog with `translate-x-[-50%] translate-y-[-50%]` — a CSS
   transform. GSAP writes the transform property wholesale, so the moment it
   tweens scale or y the centering is destroyed and the dialog jumps to the
   bottom-right quadrant. Strip the classes and let GSAP own the whole transform
   via xPercent/yPercent, which compose with x/y/scale instead of fighting them. */
const centeringClasses = (markup.match(/translate-[xy]-\[-50%\]/g) || []).length;
markup = markup.replace(/\s*translate-[xy]-\[-50%\]/g, "");

const { markup: cleaned, stats } = delint(markup);
markup = cleaned;

const { css, fontFallbacks } = compileTailwind({ dir: __dir, tmp: TMP, markup });

/* -------------------------------------------------------- emit the block */
const block = `<!-- hyperframes-registry-item: ugc-shadcn-dialog -->
<!doctype html>
<html
  lang="en"
  data-composition-variables='[
    {"id":"title","type":"string","label":"Dialog title","default":"Approve this run?"},
    {"id":"description","type":"string","label":"Dialog body","default":"The agent wants to act on your inbox and calendar."},
    {"id":"scopes","type":"string","label":"Scope badges (| between, max 3)","default":"24 emails|3 calendar events|read + write"},
    {"id":"cancelLabel","type":"string","label":"Dismiss button","default":"Not now"},
    {"id":"confirmLabel","type":"string","label":"Confirm button","default":"Approve"},
    {"id":"confirmedLabel","type":"string","label":"Confirmed button","default":"Approved"},
    {"id":"caption","type":"string","label":"Caption","default":"you stay in the loop"},
    {"id":"accent","type":"color","label":"Accent","default":"#CD6E58"}
  ]'
>
  <head>
    <meta charset="UTF-8" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <!--
      GENERATED FILE — do not hand-edit.
      Source: registry/tools/react-prerender/dialog-app.jsx
      Rebuild: cd registry/tools/react-prerender && npm run build:dialog

      Real shadcn/ui Dialog + Badge + Button, rendered by React in headless
      Chrome at build time. No React ships to the renderer.

      BAKED vs LIVE: all text is live. The badge COUNT is baked at three — a
      fourth entry in the scopes prop is ignored, because the markup for it was
      never generated.
    -->
    <style>
${css}
    </style>
    <style>
      #root {
        position: absolute;
        inset: 0;
        font-family: "Inter", sans-serif;
        --accent: #cd6e58;
      }
      /* Radix ships these as position:fixed. Inside a composition that is a trap:
         once GSAP puts a transform on any ancestor, fixed resolves against that
         ancestor instead of the viewport. #root is inset:0 at full canvas size,
         so absolute is equivalent and immune. These rules follow the Tailwind
         layer, so they win. */
      [data-slot="dialog-overlay"],
      [data-slot="dialog-content"] {
        position: absolute;
      }
      [data-slot="dialog-overlay"] {
        opacity: 0;
      }
      /* ⚠ The renderer embeds real Inter; a local browser usually falls back to a
         narrower face. Text is therefore WIDER in the render than in preview, and
         a footer that fits on screen can walk out of the dialog's padding once
         rendered — measured 4px overflow in-browser vs 50px in the render.
         DialogContent is a grid, and grid items default to min-width:auto, so
         they refuse to shrink and overflow instead. Pin the track and let them. */
      [data-slot="dialog-content"] {
        grid-template-columns: minmax(0, 1fr);
      }
      [data-slot="dialog-content"] > * {
        min-width: 0;
      }
      [data-slot="dialog-footer"] {
        flex-wrap: wrap;
      }
      [data-slot="dialog-content"] {
        /* ⚠ shadcn hard-codes sm:max-w-lg (512px) on DialogContent. The renderer
           is a fixed 1080px viewport, so the sm: breakpoint ALWAYS matches, and
           tailwind-merge does not merge across breakpoint variants — a w-[860px]
           on the className loses to it silently and the dialog renders half size.
           No backticks in this comment: it lives inside a template literal.
           Settle it here, after the Tailwind layer, where it cannot be outvoted. */
        width: 880px;
        max-width: none;
        opacity: 0;
        border: 1.5px solid #eceae6;
        box-shadow: 0 30px 90px rgba(17, 17, 17, 0.22);
      }
      /* The confirmed state sits exactly on top of the idle one and is revealed
         by a tl.set crossfade, so a reverse seek can never strand the wrong one. */
      #sd-confirmed {
        opacity: 0;
      }
      /* The pack's full-bleed caption treatment (.bcap in ugc-dashboard), in
         paper-on-dark here because the overlay dims the frame behind it. */
      #sd-caption {
        position: absolute;
        /* Above the overlay. Radix gives the scrim z-50 and it covers the whole
           frame, so anything painted without a z-index sits underneath it — the
           caption rendered but was invisible. */
        z-index: 60;
        left: 0;
        top: 1480px;
        width: 1080px;
        text-align: center;
        font-family: "Playfair Display", serif;
        font-weight: 900;
        font-style: italic;
        font-size: 74px;
        text-transform: uppercase;
        color: #fdfdfd;
        opacity: 0;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="ugc-shadcn-dialog"
      data-start="0"
      data-duration="${DURATION}"
      data-width="1080"
      data-height="1920"
    >
      <div id="sd-stage" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="0">
${markup
  .split("\n")
  .map((l) => "        " + l)
  .join("\n")}
      </div>
      <div id="sd-caption" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="1">
        you stay in the loop
      </div>
    </div>

    <script>
      (function () {
        window.__timelines = window.__timelines || {};
        ${VARIABLES_PREAMBLE}

        const root = document.getElementById("root");
        if (V.accent) root.style.setProperty("--accent", V.accent);

        const set = (id, val) => {
          if (val) document.getElementById(id).textContent = val;
        };
        set("sd-title", V.title);
        set("sd-desc", V.description);
        set("sd-cancel", V.cancelLabel);
        set("sd-confirm", V.confirmLabel);
        set("sd-confirmed", V.confirmedLabel);
        set("sd-caption", V.caption);

        // The badge count is baked; only the text is live.
        const badges = Array.from(document.querySelectorAll('#sd-badges [data-slot="badge"]'));
        if (V.scopes) {
          String(V.scopes)
            .split("|")
            .slice(0, badges.length)
            .forEach((t, i) => {
              badges[i].textContent = t.trim();
            });
        }

        const overlay = document.querySelector('[data-slot="dialog-overlay"]');
        const content = document.querySelector('[data-slot="dialog-content"]');

        // GSAP owns the ENTIRE transform. xPercent/yPercent replace the Tailwind
        // centering classes stripped at build time and compose with scale/y.
        gsap.set(content, { xPercent: -50, yPercent: -50 });

        const tl = gsap.timeline({ paused: true });

        // Scrim first, then the dialog lands on it.
        tl.to(overlay, { opacity: 1, duration: 0.42, ease: "power2.out" }, 0);
        tl.fromTo(
          content,
          { opacity: 0, scale: 0.9, y: 46 },
          { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" },
          0.14,
        );

        // waterfall-entry on the copy
        tl.fromTo(
          ["#sd-title", "#sd-desc"],
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.34, ease: "power3.out", stagger: 0.1 },
          0.42,
        );

        // spring-pop-entrance, staggered — the badge beat
        tl.fromTo(
          '#sd-badges [data-slot="badge"]',
          { scale: 0, rotate: -6 },
          { scale: 1, rotate: 0, duration: 0.42, ease: "back.out(2.8)", stagger: 0.11 },
          0.82,
        );
        tl.fromTo(
          ["#sd-cancel", "#sd-confirm"],
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.32, ease: "power3.out", stagger: 0.08 },
          1.32,
        );

        // physics-press-reaction, then scale-swap-transition to the confirmed state
        tl.to("#sd-confirm", { scale: 0.93, duration: 0.12, ease: "power2.in" }, 2.35);
        tl.to("#sd-confirm", { scale: 1, duration: 0.22, ease: "back.out(3)" }, 2.47);
        tl.set("#sd-confirm", { opacity: 0 }, 2.72);
        tl.set("#sd-confirmed", { opacity: 1 }, 2.72);
        tl.fromTo(
          "#sd-confirmed",
          { scale: 0.8 },
          { scale: 1, duration: 0.36, ease: "back.out(2.4)" },
          2.72,
        );

        gsap.set("#sd-caption", { opacity: 1 });
        tl.fromTo(
          "#sd-caption",
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.34, ease: "power3.out" },
          3.35,
        );

        window.__timelines["ugc-shadcn-dialog"] = tl;
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
    ` · centering classes ${centeringClasses} · a11y ${stats.a11yTags} · unsafe ids ${stats.unsafeIds}` +
    ` · transition classes ${stats.transitions} · fixed→abs ${stats.fixedPositions}` +
    ` · font fallbacks ${fontFallbacks}`
);
console.log(`  → ${OUT}`);
