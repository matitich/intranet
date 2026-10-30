"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
export function BudgetChart({
  lines,
}: {
  lines: { name: string; current: string; accrued: string }[];
}) {
  return (
    <div
      style={{ height: 300 }}
      role="img"
      aria-label="Comparación del presupuesto vigente y devengado por área. Los importes exactos están en la tabla inferior."
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={lines.map((l) => ({
            ...l,
            current: Number(BigInt(l.current) / 1000000n),
            accrued: Number(BigInt(l.accrued) / 1000000n),
          }))}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis unit=" M" />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="current"
            name="Vigente (millones CLP)"
            fill="#244b77"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="accrued"
            name="Devengado (millones CLP)"
            fill="#bd8337"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
