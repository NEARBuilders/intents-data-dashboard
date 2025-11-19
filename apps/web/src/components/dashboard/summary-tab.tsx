"use client";

import { Badge } from "@/components/ui/badge";
import type { SnapshotType } from "@data-provider/shared-contract";

type Provider = {
  id: string;
  label: string;
  tag: string;
};

type SummaryTabProps = {
  leftProvider: Provider;
  rightProvider: Provider;
  leftSnapshot: SnapshotType | undefined;
  rightSnapshot: SnapshotType | undefined;
};

export function SummaryTab({
  leftProvider,
  rightProvider,
  leftSnapshot,
  rightSnapshot,
}: SummaryTabProps) {
  const leftTotalVolume = leftSnapshot?.volumes?.reduce(
    (sum, vol: any) => sum + vol.volumeUsd,
    0
  ) || 0;
  const rightTotalVolume = rightSnapshot?.volumes?.reduce(
    (sum, vol: any) => sum + vol.volumeUsd,
    0
  ) || 0;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold">{leftProvider.label}</h3>
          <Badge variant="secondary">{leftProvider.tag}</Badge>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Total Volume</span>
            <span className="font-mono text-sm">
              ${Math.round(leftTotalVolume).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Assets Listed</span>
            <span className="font-mono text-sm">
              {leftSnapshot?.listedAssets?.assets.length || 0}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Rate Quotes</span>
            <span className="font-mono text-sm">
              {leftSnapshot?.rates?.length || 0}
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Liquidity Data</span>
            {leftSnapshot?.liquidity ? (
              <Badge variant="default" className="text-xs">Available</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">N/A</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold">{rightProvider.label}</h3>
          <Badge variant="secondary">{rightProvider.tag}</Badge>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Total Volume</span>
            <span className="font-mono text-sm">
              ${Math.round(rightTotalVolume).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Assets Listed</span>
            <span className="font-mono text-sm">
              {rightSnapshot?.listedAssets?.assets.length || 0}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Rate Quotes</span>
            <span className="font-mono text-sm">
              {rightSnapshot?.rates?.length || 0}
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Liquidity Data</span>
            {rightSnapshot?.liquidity ? (
              <Badge variant="default" className="text-xs">Available</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">N/A</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
