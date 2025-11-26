import { useVolumes } from "@/hooks/use-route-metrics";
import { useListedAssets } from "@/lib/aggregator/hooks";
import { formatVolume } from "@/utils/comparison";
import { useMemo } from "react";
import { useAtom } from "@effect-atom/atom-react";
import { selectedProviderAtom } from "@/store/swap";
import {
  VersusComparisonTable,
  type MetricRow,
} from "./versus-comparison-table";

const handleShare = () => {
  const url = window.location.href;
  if (navigator.share) {
    navigator
      .share({
        title: "Swap Comparison",
        url: url,
      })
      .catch(() => {
        navigator.clipboard.writeText(url);
      });
  } else {
    navigator.clipboard.writeText(url);
  }
};

export const ComparisonTable = () => {
  const [selectedProvider] = useAtom(selectedProviderAtom);
  const { data: listedAssets } = useListedAssets();
  const { data: volumeData } = useVolumes("all");

  const platformMetrics: MetricRow[] = useMemo(() => {
    if (!listedAssets) {
      return [
        { label: "Unique Assets", leftValue: null, rightValue: null },
        { label: "Chains Supported", leftValue: null, rightValue: null },
        { label: "1D Volume", leftValue: null, rightValue: null },
        { label: "30D Volume", leftValue: null, rightValue: null },
        { label: "All-Time Volume", leftValue: null, rightValue: null },
      ];
    }

    const nearAssets = listedAssets.data.near_intents || [];
    const providerAssets = listedAssets.data[selectedProvider] || [];

    const nearUniqueAssets = new Set(nearAssets.map((a) => a.assetId)).size;
    const providerUniqueAssets = new Set(providerAssets.map((a) => a.assetId)).size;

    const nearChains = new Set(nearAssets.map((a) => a.blockchain)).size;
    const providerChains = new Set(providerAssets.map((a) => a.blockchain))
      .size;

    const nearVolumeData = volumeData?.data?.near_intents;
    const providerVolumeData = volumeData?.data?.[selectedProvider];

    const nearLatestVolume =
      nearVolumeData?.dataPoints?.[nearVolumeData.dataPoints.length - 1]
        ?.volumeUsd || 0;
    const near30DVolume =
      nearVolumeData?.dataPoints
        ?.slice(-30)
        .reduce((sum: number, dp: any) => sum + (dp.volumeUsd || 0), 0) || 0;
    const nearTotalVolume = nearVolumeData?.totalVolume || 0;

    const providerLatestVolume =
      providerVolumeData?.dataPoints?.[providerVolumeData.dataPoints.length - 1]
        ?.volumeUsd || 0;
    const provider30DVolume =
      providerVolumeData?.dataPoints
        ?.slice(-30)
        .reduce((sum: number, dp: any) => sum + (dp.volumeUsd || 0), 0) || 0;
    const providerTotalVolume = providerVolumeData?.totalVolume || 0;

    const getIndicator = (
      leftVal: number,
      rightVal: number,
      lowerIsBetter = false
    ): "up" | "down" | undefined => {
      if (leftVal === rightVal) return undefined;
      const leftIsBetter = lowerIsBetter
        ? leftVal < rightVal
        : leftVal > rightVal;
      return leftIsBetter ? "up" : "down";
    };

    return [
      {
        label: "Unique Assets",
        leftValue: nearUniqueAssets.toString(),
        rightValue: providerUniqueAssets.toString(),
        leftIndicator: getIndicator(nearUniqueAssets, providerUniqueAssets),
        rightIndicator: getIndicator(providerUniqueAssets, nearUniqueAssets),
      },
      {
        label: "Chains Supported",
        leftValue: nearChains.toString(),
        rightValue: providerChains.toString(),
        leftIndicator: getIndicator(nearChains, providerChains),
        rightIndicator: getIndicator(providerChains, nearChains),
      },
      {
        label: "1D Volume",
        leftValue: formatVolume(nearLatestVolume),
        rightValue: formatVolume(providerLatestVolume),
        leftIndicator: getIndicator(nearLatestVolume, providerLatestVolume),
        rightIndicator: getIndicator(providerLatestVolume, nearLatestVolume),
      },
      {
        label: "30D Volume",
        leftValue: formatVolume(near30DVolume),
        rightValue: formatVolume(provider30DVolume),
        leftIndicator: getIndicator(near30DVolume, provider30DVolume),
        rightIndicator: getIndicator(provider30DVolume, near30DVolume),
      },
      {
        label: "All-Time Volume",
        leftValue: formatVolume(nearTotalVolume),
        rightValue: formatVolume(providerTotalVolume),
        leftIndicator: getIndicator(nearTotalVolume, providerTotalVolume),
        rightIndicator: getIndicator(providerTotalVolume, nearTotalVolume),
      },
    ];
  }, [listedAssets, selectedProvider, volumeData]);

  return (
    <section className="relative w-full py-10 md:py-12 lg:py-16">
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-8 lg:px-[135px]">
        <div className="max-w-[900px] mx-auto">
          <VersusComparisonTable
            metrics={platformMetrics}
            showProviderSelector={true}
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 text-white hover:text-gray-300 transition-colors text-sm cursor-pointer"
            >
              Share →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
