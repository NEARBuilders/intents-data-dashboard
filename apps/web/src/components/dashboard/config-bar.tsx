"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Settings2, ChevronDown } from "lucide-react";
import type { TimeWindow } from "@data-provider/shared-contract";

type ProviderId = "across" | "nearIntents";
type BlockchainId = "eth" | "arb";

type RouteConfig = {
  source: {
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

interface Provider {
  id: ProviderId;
  label: string;
  tag: string;
}

type ConfigBarProps = {
  routeConfig: RouteConfig;
  onRouteChange: (config: RouteConfig) => void;
  selectedNotionals: string[];
  onNotionalsChange: (values: string[]) => void;
  selectedWindows: TimeWindow[];
  onWindowsChange: (values: TimeWindow[]) => void;
  notionals: Array<{ label: string; value: string }>;
  windows: TimeWindow[];
  rightProviderId: ProviderId;
  onRightProviderChange: (id: ProviderId) => void;
  availableProviders: Provider[];
  isLoading: boolean;
  onRefresh: () => void;
};

const BLOCKCHAIN_OPTIONS = [
  { value: "eth", label: "Ethereum" },
  { value: "arb", label: "Arbitrum" },
] as const;

const buildAssetId = (blockchain: string, contractAddress: string) =>
  `nep141:${blockchain}-${contractAddress}.omft.near`;

export function ConfigBar({
  routeConfig,
  onRouteChange,
  selectedNotionals,
  onNotionalsChange,
  selectedWindows,
  onWindowsChange,
  notionals,
  windows,
  rightProviderId,
  onRightProviderChange,
  availableProviders,
  isLoading,
  onRefresh,
}: ConfigBarProps) {
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [draftRoute, setDraftRoute] = useState(routeConfig);

  const handleOpenRouteEditor = () => {
    setDraftRoute(routeConfig);
    setRouteEditorOpen(true);
  };

  const handleUpdateRoute = () => {
    const updatedRoute: RouteConfig = {
      source: {
        ...draftRoute.source,
        assetId: buildAssetId(
          draftRoute.source.blockchain,
          draftRoute.source.contractAddress
        ),
      },
      destination: {
        ...draftRoute.destination,
        assetId: buildAssetId(
          draftRoute.destination.blockchain,
          draftRoute.destination.contractAddress
        ),
      },
    };
    onRouteChange(updatedRoute);
    setRouteEditorOpen(false);
  };

  const routeSummary = `${routeConfig.source.blockchain.toUpperCase()} / ${
    routeConfig.source.symbol
  } → ${routeConfig.destination.blockchain.toUpperCase()} / ${
    routeConfig.destination.symbol
  }`;

  const notionalsLabel =
    selectedNotionals.length === notionals.length
      ? "All"
      : `${selectedNotionals.length} selected`;

  const windowsLabel =
    selectedWindows.length === windows.length
      ? "All"
      : selectedWindows.join(", ");

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Popover open={routeEditorOpen} onOpenChange={setRouteEditorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenRouteEditor}
                  className="gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="font-mono text-xs">{routeSummary}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96" align="start">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Route Configuration</h4>
                    <p className="text-xs text-muted-foreground">
                      Configure source and destination for the route
                    </p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Source Chain</Label>
                        <Select
                          value={draftRoute.source.blockchain}
                          onValueChange={(value: BlockchainId) =>
                            setDraftRoute({
                              ...draftRoute,
                              source: { ...draftRoute.source, blockchain: value },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                        <Label className="text-xs">Asset</Label>
                        <Input
                          value={draftRoute.source.symbol}
                          onChange={(e) =>
                            setDraftRoute({
                              ...draftRoute,
                              source: { ...draftRoute.source, symbol: e.target.value },
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Contract</Label>
                        <Input
                          value={draftRoute.source.contractAddress}
                          onChange={(e) =>
                            setDraftRoute({
                              ...draftRoute,
                              source: {
                                ...draftRoute.source,
                                contractAddress: e.target.value,
                              },
                            })
                          }
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="text-lg text-muted-foreground pt-6">→</div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Destination Chain</Label>
                        <Select
                          value={draftRoute.destination.blockchain}
                          onValueChange={(value: BlockchainId) =>
                            setDraftRoute({
                              ...draftRoute,
                              destination: {
                                ...draftRoute.destination,
                                blockchain: value,
                              },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
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
                        <Label className="text-xs">Asset</Label>
                        <Input
                          value={draftRoute.destination.symbol}
                          onChange={(e) =>
                            setDraftRoute({
                              ...draftRoute,
                              destination: {
                                ...draftRoute.destination,
                                symbol: e.target.value,
                              },
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Contract</Label>
                        <Input
                          value={draftRoute.destination.contractAddress}
                          onChange={(e) =>
                            setDraftRoute({
                              ...draftRoute,
                              destination: {
                                ...draftRoute.destination,
                                contractAddress: e.target.value,
                              },
                            })
                          }
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleUpdateRoute} className="w-full" size="sm">
                    Update Route
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="text-xs">Notionals:</span>
                  <span className="text-xs text-muted-foreground">{notionalsLabel}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">Notionals</h4>
                    <p className="text-xs text-muted-foreground">
                      Select notional values to compare
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
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
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="text-xs">Windows:</span>
                  <span className="text-xs text-muted-foreground">{windowsLabel}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="start">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm">Time Windows</h4>
                    <p className="text-xs text-muted-foreground">
                      Select time windows to analyze
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
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
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Compare:</Label>
              <Select
                value={rightProviderId}
                onValueChange={(value: ProviderId) => onRightProviderChange(value)}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
