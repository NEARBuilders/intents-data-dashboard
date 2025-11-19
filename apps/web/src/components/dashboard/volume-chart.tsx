"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SnapshotType } from "@data-provider/shared-contract";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type VolumeChartProps = {
  snapshots: Record<string, SnapshotType | undefined>;
  providerLabels: Record<string, string>;
};

export function VolumeChart({ snapshots, providerLabels }: VolumeChartProps) {
  const chartData = useMemo(() => {
    const windowMap = new Map<string, any>();

    Object.entries(snapshots).forEach(([providerId, snapshot]) => {
      if (!snapshot?.volumes) return;

      snapshot.volumes.forEach((vol: any) => {
        if (!windowMap.has(vol.window)) {
          windowMap.set(vol.window, { window: vol.window });
        }
        const point = windowMap.get(vol.window);
        point[providerId] = Math.round(vol.volumeUsd);
      });
    });

    return Array.from(windowMap.values());
  }, [snapshots]);

  const providerKeys = Object.keys(snapshots).filter(
    (id) => snapshots[id]?.volumes
  );

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="window" className="text-xs" />
            <YAxis
              className="text-xs"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
            {providerKeys.map((providerId, idx) => (
              <Line
                key={providerId}
                type="monotone"
                dataKey={providerId}
                name={providerLabels[providerId] || providerId}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
