/* Mounted ONCE in headless Chrome at build time, then discarded.
   Rendered at final composition scale so the type is crisp — no CSS upscaling.

   Colors are passed to Recharts as `var(--…)` strings. Recharts writes prop
   values straight through to SVG attributes, so the emitted markup stays
   themeable and the block's accent prop still works after baking. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./shadcn-src/ui/card";
import { Badge } from "./shadcn-src/ui/badge";
import { Progress } from "./shadcn-src/ui/progress";

const CHART_W = 856;
const CHART_H = 300;

const series = [
  { m: "Feb", v: 12 }, { m: "Mar", v: 19 }, { m: "Apr", v: 17 }, { m: "May", v: 28 },
  { m: "Jun", v: 26 }, { m: "Jul", v: 41 }, { m: "Aug", v: 52 }, { m: "Sep", v: 68 },
];

const root = createRoot(document.getElementById("mount"));
flushSync(() =>
  root.render(
    <Card id="sc-card" className="w-[940px] gap-7 rounded-[28px] px-2 py-9 shadow-none">
      <CardHeader className="gap-2 px-9">
        <CardTitle id="sc-title" className="text-[46px] font-extrabold leading-none tracking-tight">
          Pipeline
        </CardTitle>
        <CardDescription id="sc-desc" className="text-[26px] leading-tight">
          Trailing eight months
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-7 px-9">
        <div className="flex items-center gap-5">
          <span id="sc-value" className="text-[104px] font-black leading-none tabular-nums">
            $0
          </span>
          <Badge
            id="sc-badge"
            className="rounded-full px-4 py-1.5 text-[24px] font-bold"
            style={{ background: "var(--accent)", color: "#fff", borderColor: "transparent" }}
          >
            +318%
          </Badge>
        </div>

        {/* shadcn ships `transition-all` here. A seekable runtime must own this
            state, so the class is stripped in the emitter and GSAP drives it. */}
        <Progress id="sc-progress" value={68} className="h-4" />

        <AreaChart
          width={CHART_W}
          height={CHART_H}
          data={series}
          margin={{ top: 8, right: 30, bottom: 20, left: 30 }}
        >
          <CartesianGrid strokeDasharray="4 6" stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="m"
            tickLine={false}
            axisLine={false}
            fontSize={24}
            stroke="var(--muted)"
            dy={8}
          />
          <Area
            dataKey="v"
            stroke="var(--accent)"
            strokeWidth={5}
            fill="var(--accent)"
            fillOpacity={0.14}
            isAnimationActive={false}
          />
        </AreaChart>
      </CardContent>
    </Card>
  )
);
