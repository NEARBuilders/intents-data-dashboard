import type { RateType } from "@data-provider/shared-contract";
import type { EnrichedAsset } from "@/lib/coingecko/types";
import { parse1csToAsset } from "@/lib/1cs-utils";

export function calculateEstimatedFee(
  rate: RateType,
  coinGeckoAssets?: EnrichedAsset[]
): number | null {
  if (!coinGeckoAssets || coinGeckoAssets.length === 0) {
    return null;
  }

  try {
    const sourceAssetParsed = parse1csToAsset(rate.source.assetId);
    const destAssetParsed = parse1csToAsset(rate.destination.assetId);

    if (!sourceAssetParsed || !destAssetParsed) {
      return null;
    }

    const sourcePrice = findAssetPrice(
      rate.source.symbol,
      sourceAssetParsed.blockchain,
      sourceAssetParsed.contractAddress,
      coinGeckoAssets
    );

    const destPrice = findAssetPrice(
      rate.destination.symbol,
      destAssetParsed.blockchain,
      destAssetParsed.contractAddress,
      coinGeckoAssets
    );

    if (sourcePrice === null || destPrice === null) {
      return null;
    }

    const amountInNum = Number(rate.amountIn) / Math.pow(10, rate.source.decimals);
    const amountOutNum = Number(rate.amountOut) / Math.pow(10, rate.destination.decimals);

    const valueIn = amountInNum * sourcePrice;
    const valueOut = amountOutNum * destPrice;

    const fee = valueIn - valueOut;

    return fee >= 0 ? fee : 0;
  } catch (error) {
    console.error("Error calculating estimated fee:", error);
    return null;
  }
}

function findAssetPrice(
  symbol: string,
  blockchain?: string,
  contractAddress?: string,
  coinGeckoAssets?: EnrichedAsset[]
): number | null {
  if (!coinGeckoAssets) return null;

  const normalizedSymbol = symbol.toLowerCase();

  for (const asset of coinGeckoAssets) {
    if (asset.symbol.toLowerCase() === normalizedSymbol) {
      if (blockchain && contractAddress) {
        const platformAddress = asset.platforms[blockchain];
        if (platformAddress && platformAddress.toLowerCase() === contractAddress.toLowerCase()) {
          return asset.current_price;
        }
      }

      if (!contractAddress && blockchain) {
        const hasNativeToken = asset.platforms[blockchain] === "";
        if (hasNativeToken) {
          return asset.current_price;
        }
      }

      if (asset.symbol.toLowerCase() === normalizedSymbol && !contractAddress) {
        return asset.current_price;
      }
    }
  }

  const fallbackMatch = coinGeckoAssets.find(
    (a) => a.symbol.toLowerCase() === normalizedSymbol
  );

  return fallbackMatch?.current_price ?? null;
}
