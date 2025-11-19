"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SnapshotType } from "@data-provider/shared-contract";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
    const windowOrder = ["cumulative", "30d", "7d", "24h"];

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

    return Array.from(windowMap.values()).sort((a, b) => {
      const indexA = windowOrder.indexOf(a.window);
      const indexB = windowOrder.indexOf(b.window);
      return indexA - indexB;
    });
  }, [snapshots]);

  const providerKeys = Object.keys(snapshots).filter(
    (id) => snapshots[id]?.volumes
  );

  const colors = [
    "#60a5fa",
    "#34d399", 
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#2dd4bf",
    "#fb923c",
    "#f472b6",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="window" className="text-xs" />
            <YAxis
              className="text-xs"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString()}`}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                padding: "12px",
              }}
              labelStyle={{
                color: "var(--card-foreground)",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            />
            <Legend />
            {providerKeys.map((providerId, idx) => (
              <Bar
                key={providerId}
                dataKey={providerId}
                name={providerLabels[providerId] || providerId}
                fill={colors[idx % colors.length]}
                stackId="volume"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
