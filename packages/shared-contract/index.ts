import type { z } from 'every-plugin/zod';
import {
  Asset,
  LiquidityDepthPoint,
  ListedAssets,
  VolumeWindow
} from './contract';

export * from './contract';

export type AssetType = z.infer<typeof Asset>;
export type RateType<TAsset = AssetType> = {
  source: TAsset;
  destination: TAsset;
  amountIn: string;
  amountOut: string;
  effectiveRate: number;
  totalFeesUsd: number | null;
  quotedAt: string;
};
export type LiquidityDepthPointType = z.infer<typeof LiquidityDepthPoint>;
export type LiquidityDepthType<TAsset = AssetType> = {
  route: RouteType<TAsset>;
  thresholds: Array<{
    maxAmountIn: string;
    slippageBps: number;
  }>;
  measuredAt: string;
};
export type VolumeWindowType = z.infer<typeof VolumeWindow>;
export type ListedAssetsType = z.infer<typeof ListedAssets>;
export type SnapshotType<TAsset = AssetType> = {
  volumes: VolumeWindowType[];
  listedAssets: {
    assets: TAsset[];
    measuredAt: string;
  };
  rates?: RateType<TAsset>[];
  liquidity?: LiquidityDepthType<TAsset>[];
};
export type RouteType<TAsset = AssetType> = { source: TAsset; destination: TAsset };

export type TimeWindow = VolumeWindowType['window'];
