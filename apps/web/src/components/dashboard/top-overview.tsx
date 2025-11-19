"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { TimeWindow } from "@data-provider/shared-contract";

type BlockchainId = "eth" | "arb"; // TODO: 1cs blockchain ids 

type RouteConfig = {
  source: { // TODO: Asset 
    blockchain: BlockchainId;
    symbol: string;
    decimals: number;
    contractAddress: string;
    assetId: string;
  };
  destination: {
    blockchain: BlockchainId;
    symbol: string;
    decimals: number;
    contractAddress: string;
    assetId: string;
  };
};

type Notional = {
  label: string;
  value: string;
};

const BLOCKCHAIN_OPTIONS = [
  { value: "eth", label: "Ethereum" },
  { value: "arb", label: "Arbitrum" },
] as const;

type TopOverviewProps = {
  routeConfig: RouteConfig;
  onRouteChange: (config: RouteConfig) => void;
  selectedNotionals: string[];
  onNotionalsChange: (notionals: string[]) => void;
  selectedWindows: TimeWindow[];
  onWindowsChange: (windows: TimeWindow[]) => void;
  notionals: Notional[];
  windows: TimeWindow[];
  isLoading: boolean;
  onRefresh: () => void;
};

// TODO: proper asset id
const buildAssetId = (blockchain: string, contractAddress: string) =>
  `nep141:${blockchain}-${contractAddress}.omft.near`;

export function TopOverview({
  routeConfig,
  onRouteChange,
  selectedNotionals,
  onNotionalsChange,
  selectedWindows,
  onWindowsChange,
  notionals,
  windows,
  isLoading,
  onRefresh,
}: TopOverviewProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Configuration</CardTitle>
        <Button
          onClick={onRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="route" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="route">Route</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="route" className="space-y-4">
            <div className="grid md:grid-cols-[1fr_auto_1fr] items-end gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Source Blockchain</Label>
                  <Select
                    value={routeConfig.source.blockchain}
                    onValueChange={(value: BlockchainId) =>
                      onRouteChange({
                        ...routeConfig,
                        source: {
                          ...routeConfig.source,
                          blockchain: value,
                          assetId: buildAssetId(
                            value,
                            routeConfig.source.contractAddress
                          ),
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCKCHAIN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Source Asset</Label>
                  <Input
                    value={routeConfig.source.symbol}
                    onChange={(e) =>
                      onRouteChange({
                        ...routeConfig,
                        source: { ...routeConfig.source, symbol: e.target.value },
                      })
                    }
                    className="h-9"
                  />
                </div>

                <div>
                  <Label className="text-xs">Source Contract</Label>
                  <Input
                    value={routeConfig.source.contractAddress}
                    onChange={(e) => {
                      const contractAddress = e.target.value;
                      onRouteChange({
                        ...routeConfig,
                        source: {
                          ...routeConfig.source,
                          contractAddress,
                          assetId: buildAssetId(
                            routeConfig.source.blockchain,
                            contractAddress
                          ),
                        },
                      });
                    }}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="text-xl text-muted-foreground pb-2">→</div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Destination Blockchain</Label>
                  <Select
                    value={routeConfig.destination.blockchain}
                    onValueChange={(value: BlockchainId) =>
                      onRouteChange({
                        ...routeConfig,
                        destination: {
                          ...routeConfig.destination,
                          blockchain: value,
                          assetId: buildAssetId(
                            value,
                            routeConfig.destination.contractAddress
                          ),
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOCKCHAIN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Destination Asset</Label>
                  <Input
                    value={routeConfig.destination.symbol}
                    onChange={(e) =>
                      onRouteChange({
                        ...routeConfig,
                        destination: {
                          ...routeConfig.destination,
                          symbol: e.target.value,
                        },
                      })
                    }
                    className="h-9"
                  />
                </div>

                <div>
                  <Label className="text-xs">Destination Contract</Label>
                  <Input
                    value={routeConfig.destination.contractAddress}
                    onChange={(e) => {
                      const contractAddress = e.target.value;
                      onRouteChange({
                        ...routeConfig,
                        destination: {
                          ...routeConfig.destination,
                          contractAddress,
                          assetId: buildAssetId(
                            routeConfig.destination.blockchain,
                            contractAddress
                          ),
                        },
                      });
                    }}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Notionals</Label>
              <div className="flex flex-wrap gap-4">
                {notionals.map(({ label, value }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`notional-${value}`}
                      checked={selectedNotionals.includes(value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onNotionalsChange([...selectedNotionals, value]);
                        } else {
                          onNotionalsChange(
                            selectedNotionals.filter((v) => v !== value)
                          );
                        }
                      }}
                    />
                    <label
                      htmlFor={`notional-${value}`}
                      className="text-sm cursor-pointer"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Time Windows</Label>
              <div className="flex flex-wrap gap-4">
                {windows.map((window) => (
                  <div key={window} className="flex items-center space-x-2">
                    <Checkbox
                      id={`window-${window}`}
                      checked={selectedWindows.includes(window)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onWindowsChange([...selectedWindows, window]);
                        } else {
                          onWindowsChange(
                            selectedWindows.filter((w) => w !== window)
                          );
                        }
                      }}
                    />
                    <label
                      htmlFor={`window-${window}`}
                      className="text-sm cursor-pointer"
                    >
                      {window}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
