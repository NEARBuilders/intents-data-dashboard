import { oc, type ContractRouterClient } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const TimeWindowEnumDefine = z.enum(["24h", "7d", "30d", "90d", "all"]);

export const TimeWindowEnum = TimeWindowEnumDefine;
export type TimeWindow = z.infer<typeof TimeWindowEnum>;

// --- Schemas ---

export const Asset = z.object({
  assetId: z.string(), // canonical 1cs_v1 format
  symbol: z.string(),
  decimals: z.number().int().min(0),
});

export const Rate = z.object({
  source: Asset,
  destination: Asset,
  amountIn: z.string(),
  amountOut: z.string(),
  effectiveRate: z.number().describe("amountOut/amountIn normalized for decimals"),
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

export const Route = z.object({
  source: Asset,
  destination: Asset,
});

// --- Types ---

export type AssetType = z.infer<typeof Asset>;
export type RouteType = { source: AssetType; destination: AssetType };
export type RateType = {
  source: AssetType;
  destination: AssetType;
  amountIn: string;
  amountOut: string;
  effectiveRate: number;
  quotedAt: string;
};
export type LiquidityDepthType = {
  route: RouteType;
  thresholds: Array<{
    maxAmountIn: string;
    slippageBps: number;
  }>;
  measuredAt: string;
};
export type VolumeWindowType = z.infer<typeof VolumeWindow>;
export type ListedAssetsType = z.infer<typeof ListedAssets>;

// --- Contract ---

export const contract = oc.router({
  getVolumes: oc
    .route({ method: 'POST', path: '/volumes' })
    .input(z.object({
      includeWindows: z.array(TimeWindowEnum).default(["24h"]).optional(),
      route: Route.optional(),
    }))
    .output(z.object({ volumes: z.array(VolumeWindow) })),

  getListedAssets: oc
    .route({ method: 'GET', path: '/assets' })
    .output(ListedAssets),

  getRates: oc
    .route({ method: 'POST', path: '/rates' })
    .input(z.object({
      route: Route,
      notionals: z.array(z.string()),
    }))
    .output(z.object({ rates: z.array(Rate) })),

  getLiquidity: oc
    .route({ method: 'POST', path: '/liquidity' })
    .input(z.object({
      route: Route,
    }))
    .output(z.object({ liquidity: z.array(LiquidityDepth) })),

  ping: oc
    .route({ method: 'GET', path: '/ping' })
    .output(z.object({
      status: z.literal('ok'),
      timestamp: z.iso.datetime(),
    }))
});


export type PluginClient = ContractRouterClient<typeof contract>
