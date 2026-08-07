/* Mounted once in headless Chrome at BUILD time, then thrown away.
   Recharts 3 is deliberate here: it is the version that produced an empty
   wrapper under renderToStaticMarkup. */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

const series = [
  { m: "Jan", v: 12 }, { m: "Feb", v: 19 }, { m: "Mar", v: 17 }, { m: "Apr", v: 28 },
  { m: "May", v: 26 }, { m: "Jun", v: 41 }, { m: "Jul", v: 52 }, { m: "Aug", v: 68 },
];

const root = createRoot(document.getElementById("mount"));
flushSync(() =>
  root.render(
    <AreaChart width={520} height={200} data={series}>
      <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
      <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
      <Area
        dataKey="v"
        stroke="#CD6E58"
        strokeWidth={2}
        fill="#CD6E58"
        fillOpacity={0.15}
        isAnimationActive={false}
      />
    </AreaChart>
  )
);
