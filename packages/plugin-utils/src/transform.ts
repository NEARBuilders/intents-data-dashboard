import type {
  AssetType,
  RateType,
  RouteType,
  LiquidityDepthType
} from '@data-provider/shared-contract';

/**
 * Transform a rate from provider format to canonical 1cs_v1 format.
 * Handles nested asset transformations while preserving rate data.
 */
export async function transformRate<TProviderAsset>(
  rate: RateType<TProviderAsset>,
  transformAsset: (asset: TProviderAsset) => Promise<AssetType>
): Promise<RateType<AssetType>> {
  const [source, destination] = await Promise.all([
    transformAsset(rate.source),
    transformAsset(rate.destination)
  ]);

  return {
    source,
    destination,
    amountIn: rate.amountIn,
    amountOut: rate.amountOut,
    effectiveRate: rate.effectiveRate,
    totalFeesUsd: rate.totalFeesUsd,
    quotedAt: rate.quotedAt
  };
}

/**
 * Transform liquidity depth from provider format to canonical 1cs_v1 format.
 * Handles nested route and asset transformations.
 */
export async function transformLiquidity<TProviderAsset>(
  liquidity: LiquidityDepthType<TProviderAsset>,
  transformAsset: (asset: TProviderAsset) => Promise<AssetType>
): Promise<LiquidityDepthType<AssetType>> {
  const [source, destination] = await Promise.all([
    transformAsset(liquidity.route.source),
    transformAsset(liquidity.route.destination)
  ]);

  return {
    route: { source, destination },
    thresholds: liquidity.thresholds,
    measuredAt: liquidity.measuredAt
  };
}

/**
 * Transform a simple route object from provider format to canonical 1cs_v1 format.
 */
export async function transformRoute<TProviderAsset>(
  route: RouteType<TProviderAsset>,
  transformAsset: (asset: TProviderAsset) => Promise<AssetType>
): Promise<RouteType<AssetType>> {
  const [source, destination] = await Promise.all([
    transformAsset(route.source),
    transformAsset(route.destination)
  ]);

  return { source, destination };
}
