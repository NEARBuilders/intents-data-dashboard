"use client";

import { Progress } from "@/components/ui/progress";
import type { SnapshotType } from "@data-provider/shared-contract";

type Provider = {
  id: string;
  label: string;
  tag: string;
};

type LiquidityTabProps = {
  leftProvider: Provider;
  rightProvider: Provider;
  leftSnapshot: SnapshotType | undefined;
  rightSnapshot: SnapshotType | undefined;
};

export function LiquidityTab({
  leftProvider,
  rightProvider,
  leftSnapshot,
  rightSnapshot,
}: LiquidityTabProps) {
  const slippageThresholds = [50, 100];

  // TODO: this is not good.
  const leftDecimals = leftProvider.id === "across" ? 1e18 : 1e6;
  const rightDecimals = rightProvider.id === "across" ? 1e18 : 1e6;

  return (
    <div className="space-y-6">
      {slippageThresholds.map((bps) => {
        const leftThreshold = leftSnapshot?.liquidity?.[0]?.thresholds?.find(
          (t) => t.slippageBps === bps
        );
        const rightThreshold = rightSnapshot?.liquidity?.[0]?.thresholds?.find(
          (t) => t.slippageBps === bps
        );

        const leftAmount = leftThreshold
          ? Math.round(Number(leftThreshold.maxAmountIn) / leftDecimals)
          : 0;
        const rightAmount = rightThreshold
          ? Math.round(Number(rightThreshold.maxAmountIn) / rightDecimals)
          : 0;

        const maxAmount = Math.max(leftAmount, rightAmount, 1);
        const leftPercent = (leftAmount / maxAmount) * 100;
        const rightPercent = (rightAmount / maxAmount) * 100;

        return (
          <div key={bps} className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold text-sm">
              {bps} bps Slippage Threshold
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {leftProvider.label}
                  </span>
                  <span className="font-mono">
                    {leftThreshold
                      ? `${leftAmount.toLocaleString()} USDC`
                      : "No data"}
                  </span>
                </div>
                <Progress value={leftPercent} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {rightProvider.label}
                  </span>
                  <span className="font-mono">
                    {rightThreshold
                      ? `${rightAmount.toLocaleString()} USDC`
                      : "No data"}
                  </span>
                </div>
                <Progress value={rightPercent} className="h-2" />
              </div>
            </div>
          </div>
        );
      })}

      {!leftSnapshot?.liquidity && !rightSnapshot?.liquidity && (
        <div className="text-center py-8 text-muted-foreground">
          No liquidity data available
        </div>
      )}
    </div>
  );
}
