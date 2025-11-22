import { CommonPluginErrors } from "every-plugin";
import { oc, type ContractRouterClient } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const TimeWindowEnumDefine = z.enum(["24h", "7d", "30d", "cumulative"]);

export const TimeWindowEnum = TimeWindowEnumDefine;
export type TimeWindow = z.infer<typeof TimeWindowEnum>;

// --- Schemas ---

export const Asset = z.object({
  blockchain: z.string(),
  assetId: z.string(), // intents API
  symbol: z.string(),
  decimals: z.number().int().min(0),
  contractAddress: z.string(),
});

export const Rate = z.object({
  source: Asset,
  destination: Asset,
  amountIn: z.string(),
  amountOut: z.string(),
  effectiveRate: z.number().describe("amountOut/amountIn normalized for decimals"),
  totalFeesUsd: z.number().nullable(),
  quotedAt: z.iso.datetime(),
});

export const LiquidityDepthPoint = z.object({
  maxAmountIn: z.string(),
  slippageBps: z.number(),
});

export const LiquidityDepth = z.object({
  route: z.object({ source: Asset, destination: Asset }),
  thresholds: z.array(LiquidityDepthPoint),
  measuredAt: z.iso.datetime(),
});

export const VolumeWindow = z.object({
  window: TimeWindowEnum,
  volumeUsd: z.number(),
  measuredAt: z.iso.datetime(),
});

export const ListedAssets = z.object({
  assets: z.array(Asset),
  measuredAt: z.iso.datetime(),
});

export const Snapshot = z.object({
  volumes: z.array(VolumeWindow),
  listedAssets: ListedAssets,
  rates: z.array(Rate).optional(),
  liquidity: z.array(LiquidityDepth).optional(),
});

export const Route = z.object({
  source: Asset,
  destination: Asset,
});

// --- Generic Types (for service layer) ---

export type AssetType = z.infer<typeof Asset>;
export type RouteType<TAsset> = { source: TAsset; destination: TAsset };
export type RateType<TAsset> = {
  source: TAsset;
  destination: TAsset;
  amountIn: string;
  amountOut: string;
  effectiveRate: number;
  totalFeesUsd: number | null;
  quotedAt: string;
};
export type LiquidityDepthType<TAsset> = {
  route: RouteType<TAsset>;
  thresholds: Array<{
    maxAmountIn: string;
    slippageBps: number;
  }>;
  measuredAt: string;
};
export type VolumeWindowType = z.infer<typeof VolumeWindow>;
export type ListedAssetsType = z.infer<typeof ListedAssets>;
export type SnapshotType = z.infer<typeof Snapshot>;

// --- Contract ---

export const contract = oc.router({
  // Individual routes - no middleware, expect provider format
  getVolumes: oc
    .route({ method: 'POST', path: '/volumes' })
    .input(z.object({
      includeWindows: z.array(TimeWindowEnum).default(["24h"]).optional(),
    }))
    .output(z.object({ volumes: z.array(VolumeWindow) }))
    .errors(CommonPluginErrors),

  getListedAssets: oc
    .route({ method: 'GET', path: '/assets' })
    .output(ListedAssets)
    .errors(CommonPluginErrors),

  getRates: oc
    .route({ method: 'POST', path: '/rates' })
    .input(z.object({
      routes: z.array(Route),
      notionals: z.array(z.string()),
    }))
    .output(z.object({ rates: z.array(Rate) }))
    .errors(CommonPluginErrors),

  getLiquidity: oc
    .route({ method: 'POST', path: '/liquidity' })
    .input(z.object({
      routes: z.array(Route),
    }))
    .output(z.object({ liquidity: z.array(LiquidityDepth) }))
    .errors(CommonPluginErrors),

  // Composite route - with middleware, accepts NEAR Intents format
  getSnapshot: oc
    .route({ method: "POST", path: "/snapshot" })
    .input(z.object({
      routes: z.array(z.object({ source: Asset, destination: Asset })).optional(),
      notionals: z.array(z.string()).optional(),
      includeWindows: z.array(TimeWindowEnum)
        .default(["24h"]).optional(),
    }))
    .output(Snapshot)
    .errors(CommonPluginErrors),

  ping: oc
    .route({ method: 'GET', path: '/ping' })
    .output(z.object({
      status: z.literal('ok'),
      timestamp: z.string().datetime(),
    }))
    .errors(CommonPluginErrors),
});


export type PluginClient = ContractRouterClient<typeof contract>