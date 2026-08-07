# ausar-motion

A [HyperFrames](https://hyperframes.heygen.com) registry pack — reusable motion blocks you install
with `hyperframes add`, the way you'd pull a component out of a UI library.

Nine items, all tagged `ugc-split`. Built for 1080×1920 vertical (Reels / Shorts / TikTok).

## Install

Point `registry` in your project's `hyperframes.json` at this repo:

```json
{
  "registry": "https://raw.githubusercontent.com/ausarrambeau/ausar-motion/main"
}
```

Then:

```bash
npx hyperframes add ugc-split        # the whole pack, one command
npx hyperframes add ugc-orbit-ring   # or a single block
npx hyperframes catalog              # browse
```

Blocks are vendored into your `compositions/` on install, so `check` and `render` never touch the
network afterwards.

## The format

Two shells carry the blocks:

- **Split** — a graphic stage on top, a talking-head card at the bottom, one caption word in the
  seam between them.
- **Full-bleed** — the graphic owns the frame, caption in outlined italic serif underneath.

The head card is deliberately **static** — it never moves or scales. All motion lives in the stage
above it. That restraint is what keeps the format readable at feed size.

### Frame break (optional)

`ugc-split-shell` Part 2 adds the shot where the **top of the head rises out of the card** into the
graphic stage. Build a matte first:

```bash
npx hyperframes remove-background assets/talkinghead.mp4 -o assets/head-cutout.webm --quality best
```

That transparent copy is laid over the card in exact pixel alignment and clipped so only the strip
above the card edge draws — below the edge the normal card plays, so there is no double-render and
no matte fringe across the face. The shell carries the full derivation; the numbers are computed
from the card geometry, never nudged by eye.

Two traps it documents, both of which fail quietly:

- **ffmpeg drops VP9 alpha unless you name the decoder** (`-c:v libvpx-vp9`), so alpha reads as
  fully opaque. Verify with `hyperframes snapshot`, not the browser preview — the render path
  pre-extracts frames through ffmpeg, so alpha can survive preview and still be lost in the render.
- **`remove-background` is `u2net_human_seg` — segmentation, not matting.** It degrades at exactly
  the hair edge this effect puts on display. Expect a faint fringe tinted by the original
  background: invisible at feed size, obvious at 2x. Real separation between hair and wall when
  shooting matters more than any post fix.

## The items

| Item                | Type      | Dur   | What it does                                          |
| ------------------- | --------- | ----- | ----------------------------------------------------- |
| `ugc-split-shell`   | component | —     | Host shell: paper, head card, layer order, frame break |
| `ugc-wordmark`      | block     | 3.5s  | Letters cascade into a lockup + rule + pill           |
| `ugc-folder-fan`    | block     | 4.5s  | Chips fan out of a folder along an arc                |
| `ugc-orbit-ring`    | block     | 5.5s  | Tiles ring a hub, wires draw, counter tallies         |
| `ugc-color-flood`   | block     | 2.0s  | Accent wipes up, marks pop in a column                |
| `ugc-role-stack`    | block     | 4.5s  | One slot cycles N roles under a progress rail         |
| `ugc-install-card`  | block     | 4.5s  | Name types, bar fills, status flips to a green tick   |
| `ugc-dashboard`     | block     | 5.5s  | Line chart draws, bars grow, headline numbers count   |
| `ugc-react-chart`   | block     | 5.0s  | visx chart prerendered to SVG, drawn on with GSAP     |
| `ugc-shadcn-card`   | block     | 5.5s  | Real shadcn/ui Card + Badge + Progress + Recharts area chart |

Start from `ugc-split-shell` — it's the host markup and CSS every block expects underneath.

## Props

Unlike the upstream HeyGen blocks (which are edit-after-install), every block here declares
`data-composition-variables` and reads them at init, so one file serves many looks. Override per
mount:

```html
<div
  data-composition-id="ugc-orbit-ring"
  data-composition-src="compositions/ugc-orbit-ring.html"
  data-variable-values='{"caption":"one ring to rule them","accent":"#2C7BE5"}'
  data-start="8" data-duration="5.5" data-track-index="3"
  data-width="1080" data-height="1920"
></div>
```

Variables are typed `string | number | color | boolean | enum` — **there is no array type**, so
list-shaped props use a compact delimited string parsed at init:

| Shape          | Example                                                     |
| -------------- | ----------------------------------------------------------- |
| Records        | `"Docs:D:#E4674A,Calendar:C:#2C7BE5"` (`:` fields, `,` rows) |
| Timed captions | `"a free@0.2\|pack of@1.5"` (`text@seconds`, `\|` between)  |
| Numeric series | `"0.34,0.52,0.44,0.7"`                                      |

Each block's full prop list is in its `registry-item.json` and the `data-composition-variables`
declaration at the top of its HTML.

## ⚠ One mount per block per composition

The HyperFrames docs say a host can mount the same sub-composition several times with different
`data-variable-values`. **In practice it cannot.** Two slots sharing a `data-composition-id` trip
`duplicate_composition_id` in lint, and — worse — the second `window.__timelines[id]` registration
clobbers the first, so the block mounts its markup but **no animation ever seeks**. The failure is
quiet: static content still paints, so it reads as a styling bug rather than a timing one.

To use a block twice, install a second copy under a different name (change the file name, its
`data-composition-id`, and its timeline key).

## React interop — `tools/react-prerender/`

`ugc-react-chart` is generated, not hand-written:

```bash
cd tools/react-prerender && npm install && npm run build
```

React and visx run **in Node at build time**. `renderToStaticMarkup` serialises the chart to plain
SVG, `svg-path-properties` measures the curve in Node, and the block ships with the path length
baked in as a constant. No React reaches the renderer.

This is the general pattern for using a React charting library with HyperFrames. You get the
library's **layout engine** — scales, curve interpolation, stacking, axis ticks. You cannot get its
**runtime**: Framer Motion, Recharts animations, tooltips, and hover states are driven by rAF,
state, or input events, none of which exist during a seek-based render. Animate what React produced
with GSAP instead, as this block does.

Two things that keep it deterministic and are easy to get wrong:

- **Never call `getTotalLength()` in a timeline callback.** The renderer seeks non-linearly, so
  measured geometry becomes seek-order dependent. Measure in Node; bake the constant.
- **Don't assume attribute order in generated markup.** visx emits `d` before `id`; a regex written
  the other way round silently matches nothing.

### When `renderToStaticMarkup` isn't enough — `npm run build:card`

`ugc-shadcn-card` is built from real upstream [shadcn/ui](https://ui.shadcn.com) source plus
[Recharts](https://recharts.org) — the same base [Bklit UI](https://bklit.com) sits on. Server
rendering only gets part of the way there. Measured, in `tools/react-prerender/proof/`:

| Library                                        | `renderToStaticMarkup`                        |
| ---------------------------------------------- | --------------------------------------------- |
| shadcn markup (Card/Badge, cva + tailwind-merge) | renders                                     |
| Radix inline primitives (Progress, Slot)       | renders, but effects never run so `data-state` is wrong |
| Radix portals (Dialog, Tooltip, Popover, Select) | **empty string**                            |
| Recharts 2.x                                   | renders real SVG                              |
| Recharts 3.x                                   | **empty `<div class="recharts-wrapper">`, no svg** |

Nothing throws in any of those rows — the empty ones just return nothing, so a build that only
checks for exceptions reports success and ships a blank chart.

So `build:card` mounts the component **once in headless Chrome** at build time and serialises the
DOM it produced. That covers every row at once, needs no dependency beyond the Chrome already
installed, and still ships zero React.

### Traps that exist only in the render

Each of these produced a file that was correct on disk and pixel-perfect opened directly in a
browser. Only an actual render catches them.

- **`<svg><title>` swallows the rest of the chart.** HyperFrames compiles with an HTML parser,
  where `<title>` is an RCDATA element — everything after it is consumed as escaped *text* and the
  SVG collapses into a single text node. Recharts emits `<title></title><desc></desc>` for screen
  readers. The symptom is `GSAP target not found` for every SVG selector, which sends you hunting
  through GSAP. Strip both tags; a video has no screen reader.
- **A second `id` attribute is silently ignored.** Recharts already puts a React `useId` on its
  paths, so injecting your own `id` after it does nothing — the first one wins. Whether yours lands
  depends on attribute order, so *some* tweens work. Target the `recharts-*` classes instead. Those
  generated ids also contain colons, which need CSS escaping — rewrite them.
- **Tailwind's preflight can embed ~183 MB of Apple Color Emoji.** It writes
  `var(--default-font-family, …"Apple Color Emoji"…)`. Defining the variable is not enough:
  HyperFrames resolves every family it finds in the CSS *text*, dead fallback included. Prune it.
- **shadcn's `Progress` ships `transition-all`.** A seekable runtime must own that state; GSAP
  drives the indicator transform instead.
- **Pin Tailwind's sources.** v4 auto-detects content from the CSS file's directory, so generated
  block CSS drifts with unrelated neighbouring files. Use `source(none)` *plus* an explicit
  `@source` — on its own, `source(none)` makes the CLI's `--content` flag inert and emits base
  styles with **zero utilities**, which renders as unstyled components rather than an error.

### Why not `hyperframes init --tailwind` for blocks

The flag scaffolds the pinned Tailwind browser runtime **and** the `window.__tailwindReady` promise
HyperFrames waits on before capturing frame 0. Shipping the runtime script inside a block gives you
no gate, so frames are captured mid-compile. Measured: a card that was 301px tall and pixel-perfect
in a browser rendered **149px** tall with its custom `@theme` token contributing no height and no
colour, while stock utilities applied fine. It is a race, and it fails partially and silently.

That flag is a good choice for a *host project* you author by hand in Tailwind. It is not an
alternative to prerendering, because it styles markup — it never runs React, so it cannot produce
chart geometry.

## Authoring notes

Blocks are **standalone** documents — root directly in `<body>`, styles in `<head>`, no
`<template>` wrapper. That matches the shipped HeyGen registry blocks and lets each file preview on
its own. (Sub-compositions authored *inside* a project use the `<template>` form; both mount fine
via `data-composition-src`.)

Every element id carries the block's 2-letter prefix (`uw-`, `uf-`, `uo-`, `uc-`, `ur-`, `ui-`,
`ud-`, `uk-`) so ids stay unique when several blocks mount into one page. The root keeps
`id="root"` and is styled by `#root`, never by a class — CSS is scoped to the composition id at
compile time, and a rule keyed off the root's own class silently stops matching.

Fonts are limited to HyperFrames' pre-bundled set so renders stay offline and deterministic:
Archivo Black (**weight 400 only**), Playfair Display, Inter, JetBrains Mono.

## Known check finding

`hyperframes check` reports one warning on `ugc-folder-fan`:

```
⚠ rotation_pivot_drift span.face — bounding-box center drifts 464px across rotation
```

False positive. `.face` carries a **static** CSS tilt and no tween targets it; its absolute centre
moves only because the parent chip is travelling out of the folder. The checker compares absolute
box centres over time and cannot separate "child rotated" from "parent translated."

## Licence

None declared yet — default copyright applies. Add a `LICENSE` file if you want others to reuse
these blocks.
