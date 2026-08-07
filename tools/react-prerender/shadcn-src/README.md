# Vendored shadcn/ui source

Unmodified component source from [shadcn-ui/ui](https://github.com/shadcn-ui/ui) (MIT),
copied here so the prerender build has something real to render. shadcn is distributed as
copy-into-your-project source rather than a package, so vendoring is the intended usage.

Fetched from `apps/v4/registry/new-york-v4`:

```bash
B=https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4
for f in card badge progress; do curl -sfL "$B/ui/$f.tsx" -o "ui/$f.tsx"; done
curl -sfL "$B/lib/utils.ts" -o lib/utils.ts
```

To add a component, drop its `.tsx` here and import it from `../card-app.jsx`. esbuild
handles the TypeScript and remaps shadcn's `@/lib/utils` alias — see `build-shadcn-card.mjs`.

The theme tokens these components reference are **not** from upstream: `../shadcn-theme.css`
is a hand-written equivalent of what `shadcn init` writes into `globals.css`, trimmed to the
tokens actually used and with the font stack pinned to bundled families (see the README in
`registry/` for why that matters).

Not every shadcn component survives prerendering — anything portalled (Dialog, Tooltip,
Popover, Select, Dropdown) renders empty. `proof/` measures which do.
