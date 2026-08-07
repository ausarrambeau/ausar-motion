/**
 * PROOF: can real shadcn/ui + Recharts (the Bklit UI base) survive a static
 * prerender with no React runtime at render time?
 *
 * Each capability is rendered in its own try/catch so a failure is attributable
 * to one library rather than to "React didn't work".
 */
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../shadcn-src/ui/card";
import { Badge } from "../shadcn-src/ui/badge";
import { Progress } from "../shadcn-src/ui/progress";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import { Dialog, Tooltip } from "radix-ui";

const __dir = process.env.PROOF_OUT || dirname(fileURLToPath(import.meta.url));
const report = [];
const samples = {};

/**
 * `renderToStaticMarkup` not throwing proves nothing — a portal renders as an
 * empty string and a chart can emit its wrapper with no geometry inside. So
 * every probe states what its output MUST contain to count as rendered.
 */
function probe(name, node, mustContain) {
  let html;
  try {
    html = renderToStaticMarkup(node);
  } catch (err) {
    report.push({ name, ok: false, bytes: 0, why: String(err.message || err).split("\n")[0] });
    return "";
  }
  samples[name] = html.slice(0, 400);
  const missing = mustContain.filter((needle) => !html.includes(needle));
  report.push({
    name,
    ok: missing.length === 0 && html.length > 0,
    bytes: html.length,
    why: html.length === 0 ? "rendered empty" : missing.length ? `missing ${missing.join(", ")}` : "",
  });
  return html;
}

const series = [
  { m: "Jan", v: 12, w: 8 },
  { m: "Feb", v: 19, w: 11 },
  { m: "Mar", v: 17, w: 14 },
  { m: "Apr", v: 28, w: 19 },
  { m: "May", v: 26, w: 22 },
  { m: "Jun", v: 41, w: 27 },
  { m: "Jul", v: 52, w: 31 },
  { m: "Aug", v: 68, w: 44 },
];

/* -------------------------------------------------- 1. plain shadcn markup */
probe(
  "shadcn Card + Badge (cva + cn + tailwind-merge)",
  <Card className="w-[560px]">
    <CardHeader>
      <CardTitle>Pipeline</CardTitle>
      <CardDescription>Trailing eight months</CardDescription>
    </CardHeader>
    <CardContent>
      <Badge>live</Badge>
    </CardContent>
  </Card>,
  ["data-slot=\"card\"", "Pipeline", "Trailing eight months", "data-slot=\"badge\""]
);

/* ------------------------------------------- 2. Radix primitive (no portal) */
probe("Radix Progress (inline primitive)", <Progress value={68} />, [
  "data-slot=\"progress\"",
  "data-slot=\"progress-indicator\"",
  "translateX(-32%)",
]);

/* ----------------------------------------------- 3. Radix portal components */
probe(
  "Radix Dialog (portalled content)",
  <Dialog.Root open>
    <Dialog.Portal>
      <Dialog.Content>portalled</Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>,
  ["portalled"]
);
probe(
  "Radix Tooltip (portalled content)",
  <Tooltip.Provider>
    <Tooltip.Root open>
      <Tooltip.Trigger>hover</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content>tip</Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>,
  ["hover", "tip"]
);

/* ------------------------------ 4. Recharts — the engine under Bklit/shadcn */
probe(
  "Recharts AreaChart (fixed size, animation off)",
  <AreaChart width={520} height={200} data={series}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
    <XAxis dataKey="m" tickLine={false} axisLine={false} />
    <Area dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
  </AreaChart>,
  ["<svg", "<path", "recharts-area"]
);
probe(
  "Recharts BarChart (default: animation ON)",
  <BarChart width={520} height={200} data={series}>
    <Bar dataKey="w" fill="var(--primary)" />
  </BarChart>,
  ["<svg", "recharts-bar", "<rect"]
);
probe(
  "Recharts with ResponsiveContainer (needs DOM measurement)",
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={series}>
      <Bar dataKey="w" fill="var(--primary)" isAnimationActive={false} />
    </BarChart>
  </ResponsiveContainer>,
  ["<svg", "recharts-bar", "<rect"]
);

/* --------------------------------------------------- assemble the composite */
const composite = renderToStaticMarkup(
  <div className="p-10">
    <Card className="w-[600px] gap-5">
      <CardHeader>
        <CardTitle className="text-2xl">Pipeline</CardTitle>
        <CardDescription>Trailing eight months</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold tabular-nums" id="rc-count">
            0
          </span>
          <Badge variant="secondary">+318%</Badge>
        </div>
        <Progress value={68} id="rc-progress" />
        <AreaChart width={520} height={200} data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
          <Area
            dataKey="v"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="var(--primary)"
            fillOpacity={0.15}
            isAnimationActive={false}
          />
        </AreaChart>
      </CardContent>
    </Card>
  </div>
);

mkdirSync(resolve(__dir, "out"), { recursive: true });
writeFileSync(resolve(__dir, "out/markup.html"), composite);
writeFileSync(resolve(__dir, "out/report.json"), JSON.stringify(report, null, 2));
writeFileSync(resolve(__dir, "out/samples.json"), JSON.stringify(samples, null, 2));

for (const r of report) {
  console.log(r.ok ? `  PASS  ${r.name}  (${r.bytes}b)` : `  FAIL  ${r.name}  (${r.bytes}b) — ${r.why}`);
}
