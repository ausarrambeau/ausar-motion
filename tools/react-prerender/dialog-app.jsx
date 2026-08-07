/* Mounted once in headless Chrome at build time, then discarded.
   An approval gate — the beat where an agent asks before it acts.

   Two shadcn defaults are deliberately overridden:
   - `sm:max-w-lg` would cap the dialog at 512px. The renderer is a fixed 1080px
     viewport, so the sm: breakpoint always matches; max-w-none takes it back.
   - `showCloseButton` is off. An X in the corner invites a click that can never
     happen in a video, and it drags in a lucide icon with its own <title>. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./shadcn-src/ui/dialog";
import { Badge } from "./shadcn-src/ui/badge";
import { Button } from "./shadcn-src/ui/button";

/* Explicit tones, not shadcn's variants. `secondary` is oklch(0.97 0 0) and the
   `outline` border is oklch(0.922 0 0) — both near-white on a white dialog. That
   is correct for a web UI and invisible in a video, where the badge has to read
   at feed size in half a second. */
const scopes = [
  { label: "24 emails", style: { background: "var(--accent)", color: "#fff", border: "2px solid transparent" } },
  { label: "3 calendar events", style: { background: "#EDEAE5", color: "#4A4540", border: "2px solid transparent" } },
  { label: "read + write", style: { background: "transparent", color: "#4A4540", border: "2px solid #C9C3BA" } },
];

const root = createRoot(document.getElementById("mount"));
flushSync(() =>
  root.render(
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="gap-9 rounded-[32px] p-14"
      >
        <DialogHeader className="gap-3">
          <DialogTitle
            id="sd-title"
            className="text-[62px] font-extrabold leading-none tracking-tight"
          >
            Approve this run?
          </DialogTitle>
          <DialogDescription id="sd-desc" className="text-[31px] leading-snug">
            The agent wants to act on your inbox and calendar.
          </DialogDescription>
        </DialogHeader>

        <div id="sd-badges" className="flex flex-wrap gap-4">
          {scopes.map((s, i) => (
            <Badge
              key={s.label}
              data-i={i}
              variant="outline"
              className="rounded-full px-6 py-2.5 text-[27px] font-semibold"
              style={s.style}
            >
              {s.label}
            </Badge>
          ))}
        </div>

        <DialogFooter className="gap-4 sm:justify-end">
          <Button
            id="sd-cancel"
            variant="outline"
            className="h-auto rounded-full px-10 py-5 text-[29px] font-semibold"
          >
            Not now
          </Button>
          {/* Two stacked states, crossfaded by tl.set. NOT tl.call(): a call only
              fires on a forward pass, so a reverse seek leaves the wrong label. */}
          <span className="relative inline-grid">
            <Button
              id="sd-confirm"
              className="col-start-1 row-start-1 h-auto rounded-full px-10 py-5 text-[29px] font-semibold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Approve
            </Button>
            <Button
              id="sd-confirmed"
              className="col-start-1 row-start-1 h-auto rounded-full px-10 py-5 text-[29px] font-semibold"
              style={{ background: "#12a150", color: "#fff" }}
            >
              Approved
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
);
