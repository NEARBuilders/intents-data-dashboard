import { z } from 'every-plugin/zod';

// Provider-specific schemas for cBridge API
export const CBridgeAsset = z.object({
  chainId: z.number(), // cBridge uses numeric chainId (standard format)
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  // Could add priceUsd if available from API in future
});

export const CBridgeRoute = z.object({
  source: CBridgeAsset,
  destination: CBridgeAsset
});

export type CBridgeAssetType = z.infer<typeof CBridgeAsset>;
export type CBridgeRouteType = z.infer<typeof CBridgeRoute>;

// Re-export shared contract
export { contract } from '@data-provider/shared-contract';
export * from '@data-provider/shared-contract';
