"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { SnapshotType } from "@data-provider/shared-contract";
import { Search } from "lucide-react";

type Provider = {
  id: string;
  label: string;
  tag: string;
};

type AssetsTabProps = {
  leftProvider: Provider;
  rightProvider: Provider;
  leftSnapshot: SnapshotType | undefined;
  rightSnapshot: SnapshotType | undefined;
};

export function AssetsTab({
  leftProvider,
  rightProvider,
  leftSnapshot,
  rightSnapshot,
}: AssetsTabProps) {
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  const leftAssets = leftSnapshot?.listedAssets?.assets || [];
  const rightAssets = rightSnapshot?.listedAssets?.assets || [];

  const filteredLeftAssets = leftAssets.filter((asset) =>
    asset.symbol.toLowerCase().includes(leftSearch.toLowerCase())
  );

  const filteredRightAssets = rightAssets.filter((asset) =>
    asset.symbol.toLowerCase().includes(rightSearch.toLowerCase())
  );

  const sharedAssets = leftAssets.filter((leftAsset) =>
    rightAssets.some((rightAsset) => rightAsset.symbol === leftAsset.symbol)
  );

  const uniqueLeftAssets = leftAssets.filter(
    (leftAsset) =>
      !rightAssets.some((rightAsset) => rightAsset.symbol === leftAsset.symbol)
  );

  const uniqueRightAssets = rightAssets.filter(
    (rightAsset) =>
      !leftAssets.some((leftAsset) => leftAsset.symbol === rightAsset.symbol)
  );

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {uniqueLeftAssets.length}
          </div>
          <div className="text-xs text-muted-foreground">
            Only in {leftProvider.label}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {sharedAssets.length}
          </div>
          <div className="text-xs text-muted-foreground">Shared Assets</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {uniqueRightAssets.length}
          </div>
          <div className="text-xs text-muted-foreground">
            Only in {rightProvider.label}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{leftProvider.label}</h3>
            <Badge variant="secondary" className="text-xs">
              {leftAssets.length} assets
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            <div className="p-3 space-y-1">
              {filteredLeftAssets.length > 0 ? (
                filteredLeftAssets.map((asset) => {
                  const isShared = sharedAssets.some(
                    (s) => s.symbol === asset.symbol
                  );
                  return (
                    <div
                      key={asset.assetId}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{asset.symbol}</span>
                      {isShared && (
                        <Badge variant="outline" className="text-xs">
                          Shared
                        </Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {leftSearch ? "No assets found" : "No assets available"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{rightProvider.label}</h3>
            <Badge variant="secondary" className="text-xs">
              {rightAssets.length} assets
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={rightSearch}
              onChange={(e) => setRightSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            <div className="p-3 space-y-1">
              {filteredRightAssets.length > 0 ? (
                filteredRightAssets.map((asset) => {
                  const isShared = sharedAssets.some(
                    (s) => s.symbol === asset.symbol
                  );
                  return (
                    <div
                      key={asset.assetId}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{asset.symbol}</span>
                      {isShared && (
                        <Badge variant="outline" className="text-xs">
                          Shared
                        </Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {rightSearch ? "No assets found" : "No assets available"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
