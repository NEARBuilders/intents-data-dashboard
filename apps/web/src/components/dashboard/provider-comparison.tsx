"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SnapshotType } from "@data-provider/shared-contract";
import { SummaryTab } from "./summary-tab";
import { RatesTab } from "./rates-tab";
import { LiquidityTab } from "./liquidity-tab";
import { AssetsTab } from "./assets-tab";

type Provider = {
  id: string;
  label: string;
  tag: string;
};

type ProviderComparisonProps = {
  leftProvider: Provider;
  rightProvider: Provider;
  leftSnapshot: SnapshotType | undefined;
  rightSnapshot: SnapshotType | undefined;
  selectedNotionals: string[];
  notionals: Array<{ label: string; value: string }>;
};

export function ProviderComparison({
  leftProvider,
  rightProvider,
  leftSnapshot,
  rightSnapshot,
  selectedNotionals,
  notionals,
}: ProviderComparisonProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Provider Comparison</CardTitle>
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
              {leftProvider.label}
            </span>
            <span className="text-muted-foreground">vs</span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs">
              {rightProvider.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="rates">Rates</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <SummaryTab
              leftProvider={leftProvider}
              rightProvider={rightProvider}
              leftSnapshot={leftSnapshot}
              rightSnapshot={rightSnapshot}
            />
          </TabsContent>

          <TabsContent value="rates" className="mt-4">
            <RatesTab
              leftProvider={leftProvider}
              rightProvider={rightProvider}
              leftSnapshot={leftSnapshot}
              rightSnapshot={rightSnapshot}
              selectedNotionals={selectedNotionals}
              notionals={notionals}
            />
          </TabsContent>

          <TabsContent value="liquidity" className="mt-4">
            <LiquidityTab
              leftProvider={leftProvider}
              rightProvider={rightProvider}
              leftSnapshot={leftSnapshot}
              rightSnapshot={rightSnapshot}
            />
          </TabsContent>

          <TabsContent value="assets" className="mt-4">
            <AssetsTab
              leftProvider={leftProvider}
              rightProvider={rightProvider}
              leftSnapshot={leftSnapshot}
              rightSnapshot={rightSnapshot}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
