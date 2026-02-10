"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

export function ProbabilitySparkline({ data }: { data: Array<{ at: string; probability: number }> }) {
  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip />
          <Line dataKey="probability" stroke="#7a5730" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
