import { z } from "every-plugin/zod";

/**
 * Provider-Specific Schemas for NEAR Intents Data Provider Plugin
 *
 * NEAR Intents plugin works with two distinct data formats:
 *
 * 1. **Provider Format** (defined here): Matches 1Click API's native format
 *    - Uses NEAR Intents-native field names (blockchain, assetId)
 *    - Matches 1Click TokenResponse and our derived schemas
 *    - Service layer methods work exclusively in this format
 *
 * 2. **NEAR Intents Format** (from shared-contract): The standardized format
 *    - Uses consistent field names (blockchain, assetId)
 *    - Router layer can pass through directly when provider uses same format
 *    - What clients consume via the plugin API
 *
 * Since 1Click already speaks NEAR Intents asset format, transformations are minimal.
 */

// Provider-specific asset schema - matches 1Click TokenResponse
export const ProviderAsset = z.object({
  blockchain: z.string(),            // NEAR Intents blockchain enum
  assetId: z.string(),              // Full NEP-141 style assetId
  symbol: z.string(),              // Token symbol
  decimals: z.number(),            // Token decimals
  contractAddress: z.string().optional(), // Contract address
  price: z.number().optional(),           // USD price (from 1Click)
  priceUpdatedAt: z.string().optional(),  // Price timestamp
});

// Provider-specific route schema - pair of provider assets
export const ProviderRoute = z.object({
  source: ProviderAsset,     // Source in provider format
  destination: ProviderAsset // Destination in provider format
});

// Export inferred types for use in service layer
export type ProviderAssetType = z.infer<typeof ProviderAsset>;
export type ProviderRouteType = z.infer<typeof ProviderRoute>;

export * from '@data-provider/shared-contract';