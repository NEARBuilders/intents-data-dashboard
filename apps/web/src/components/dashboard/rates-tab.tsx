"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SnapshotType } from "@data-provider/shared-contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type Provider = {
  id: string;
  label: string;
  tag: string;
};

type RatesTabProps = {
  leftProvider: Provider;
  rightProvider: Provider;
  leftSnapshot: SnapshotType | undefined;
  rightSnapshot: SnapshotType | undefined;
  selectedNotionals: string[];
  notionals: Array<{ label: string; value: string }>;
};

export function RatesTab({
  leftProvider,
  rightProvider,
  leftSnapshot,
  rightSnapshot,
  selectedNotionals,
  notionals,
}: RatesTabProps) {
  const [selectedNotional, setSelectedNotional] = useState(
    selectedNotionals[0] || notionals[0]?.value
  );
  const [showFullTable, setShowFullTable] = useState(false);

  const leftRate = leftSnapshot?.rates?.find(
    (r) => r.amountIn === selectedNotional
  );
  const rightRate = rightSnapshot?.rates?.find(
    (r) => r.amountIn === selectedNotional
  );

  const leftDecimals = leftProvider.id === "across" ? 1e18 : 1e6;
  const rightDecimals = rightProvider.id === "across" ? 1e18 : 1e6;

  const selectedNotionalLabel = notionals.find((n) => n.value === selectedNotional)?.label;

  const hasRightBetterRate = leftRate && rightRate && 
    (rightRate.effectiveRate || 0) > (leftRate.effectiveRate || 0);
  const hasRightLowerFees = leftRate && rightRate &&
    (rightRate.totalFeesUsd || 0) < (leftRate.totalFeesUsd || 0);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {notionals
          .filter((n) => selectedNotionals.includes(n.value))
          .map(({ label, value }) => (
            <Button
              key={value}
              variant={selectedNotional === value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedNotional(value)}
            >
              {label}
            </Button>
          ))}
      </div>

      {selectedNotionalLabel && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Comparing at {selectedNotionalLabel}
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{leftProvider.label}</h4>
                {hasRightBetterRate === false && leftRate && rightRate && (
                  <Badge variant="default" className="text-xs">Better Rate</Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Out</span>
                  <span className="font-mono">
                    {leftRate
                      ? `${(Number(leftRate.amountOut) / leftDecimals).toFixed(6)}`
                      : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Effective Rate</span>
                  <span className="font-mono">
                    {leftRate?.effectiveRate?.toFixed(6) || "N/A"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Fees</span>
                  <span className="font-mono">
                    {leftRate?.totalFeesUsd !== null
                      ? `$${leftRate?.totalFeesUsd?.toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{rightProvider.label}</h4>
                {hasRightBetterRate && (
                  <Badge variant="default" className="text-xs">Better Rate</Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Out</span>
                  <span className="font-mono">
                    {rightRate
                      ? `${(Number(rightRate.amountOut) / rightDecimals).toFixed(6)}`
                      : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Effective Rate</span>
                  <span className="font-mono">
                    {rightRate?.effectiveRate?.toFixed(6) || "N/A"}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Fees</span>
                  <span className="font-mono">
                    {rightRate?.totalFeesUsd !== null
                      ? `$${rightRate?.totalFeesUsd?.toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Collapsible open={showFullTable} onOpenChange={setShowFullTable}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full">
            <span>View Full Comparison Table</span>
            <ChevronDown
              className={`ml-2 h-4 w-4 transition-transform ${
                showFullTable ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Notional</th>
                  <th className="text-center py-2 px-3" colSpan={3}>
                    {leftProvider.label}
                  </th>
                  <th className="text-center py-2 px-3" colSpan={3}>
                    {rightProvider.label}
                  </th>
                </tr>
                <tr className="border-b text-xs text-muted-foreground">
                  <th></th>
                  <th className="py-1 px-3">Amount Out</th>
                  <th className="py-1 px-3">Rate</th>
                  <th className="py-1 px-3">Fees</th>
                  <th className="py-1 px-3">Amount Out</th>
                  <th className="py-1 px-3">Rate</th>
                  <th className="py-1 px-3">Fees</th>
                </tr>
              </thead>
              <tbody>
                {notionals
                  .filter((n) => selectedNotionals.includes(n.value))
                  .map(({ label, value }) => {
                    const leftR = leftSnapshot?.rates?.find((r) => r.amountIn === value);
                    const rightR = rightSnapshot?.rates?.find((r) => r.amountIn === value);

                    return (
                      <tr key={value} className="border-b">
                        <td className="py-3 px-3 font-medium">{label}</td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {leftR
                            ? `${(Number(leftR.amountOut) / leftDecimals).toFixed(6)}`
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {leftR?.effectiveRate?.toFixed(6) || "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {leftR?.totalFeesUsd !== null
                            ? `$${leftR?.totalFeesUsd?.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {rightR
                            ? `${(Number(rightR.amountOut) / rightDecimals).toFixed(6)}`
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {rightR?.effectiveRate?.toFixed(6) || "-"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-xs">
                          {rightR?.totalFeesUsd !== null
                            ? `$${rightR?.totalFeesUsd?.toFixed(2)}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
