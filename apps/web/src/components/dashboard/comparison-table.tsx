import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";
import type { Route, ProviderInfo } from "@/types/common";
import {
  VersusComparisonTable,
  type MetricRow,
} from "./versus-comparison-table";

const selectItemClassName =
  "text-white hover:bg-[#343434] hover:text-white focus:bg-[#343434] focus:text-white";

interface ComparisonTableProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  providersInfo: ProviderInfo[];
  selectedRoute: Route | null;
}

export const ComparisonTable = ({
  selectedProvider,
  onProviderChange,
  providersInfo,
}: ComparisonTableProps) => {
  const platforms = useMemo(
    () =>
      providersInfo
        .filter(
          (p) => p.id !== "near_intents" && p.supportedData?.includes("assets")
        )
        .map((p) => ({ value: p.id, label: p.label })),
    [providersInfo]
  );

  const selectedProviderInfo = useMemo(() => {
    return providersInfo.find((p) => p.id === selectedProvider);
  }, [providersInfo, selectedProvider]);

  const nearIntentsInfo = useMemo(() => {
    return providersInfo.find((p) => p.id === "near_intents");
  }, [providersInfo]);

  const platformMetrics: MetricRow[] = useMemo(() => {
    return [
      {
        label: "Unique Assets",
        leftValue: null,
        rightValue: null,
        leftIndicator: "down",
        rightIndicator: "up",
      },
      {
        label: "Chains Supported",
        leftValue: null,
        rightValue: null,
        leftIndicator: "up",
      },
      {
        label: "% Native Assets",
        leftValue: null,
        rightValue: null,
        leftIndicator: "up",
        rightIndicator: "down",
      },
      {
        label: "1D Volume",
        leftValue: null,
        rightValue: null,
        leftIndicator: "down",
        rightIndicator: "up",
      },
      {
        label: "30D Volume",
        leftValue: null,
        rightValue: null,
        leftIndicator: "down",
        rightIndicator: "up",
      },
      {
        label: "All-Time Volume",
        leftValue: null,
        rightValue: null,
        leftIndicator: "down",
        rightIndicator: "up",
      },
    ];
  }, []);

  return (
    <section className="relative w-full py-10 md:py-12 lg:py-16">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <VersusComparisonTable
          leftProvider={{
            name: nearIntentsInfo?.label || "NEAR Intents",
            icon: "/images/photopea-online-editor-image-1.png",
          }}
          rightProvider={{
            name: selectedProviderInfo?.label || "Provider",
            icon: undefined,
          }}
          metrics={platformMetrics}
          showProviderSelector={true}
          providerOptions={platforms}
          selectedProvider={selectedProvider}
          onProviderChange={onProviderChange}
        />
      </div>
    </section>
  );
};
