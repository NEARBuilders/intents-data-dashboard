import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { createTransformRoutesMiddleware, getBlockchainFromChainId, getChainId, transformRate, transformLiquidity } from "@data-provider/plugin-utils";
import { ProviderApiClient } from "./client";
import type { AssetType, ProviderAssetType, ProviderRouteType, RouteType } from "./contract";
import { contract } from "./contract";
import { DataProviderService } from "./service";

/**
 * Data Provider Plugin Template
 *
 * This template demonstrates the multi-route + middleware architecture for data provider plugins.
 * Key architectural patterns:
 *
 * 1. **Two-Format Architecture**: Plugin works with both provider-specific format and NEAR Intents format
 *    - Provider Format: Matches external API (ProviderAssetType, ProviderRouteType in contract.ts)
 *    - NEAR Intents Format: Standardized client interface (AssetType, RouteType from shared-contract)
 *
 * 2. **Layer Separation**:
 *    - Service Layer: Business logic in provider format, calls external APIs
 *    - Router Layer: Transformation between formats, middleware for route handling
 *
 * 3. **Middleware Pattern**: oRPC middleware automatically transforms routes for certain endpoints
 *    - getRates, getLiquidity, getSnapshot: Use middleware (accept NEAR Intents, transform to provider)
 *    - getVolumes, getListedAssets: No middleware (work with standardized inputs)
 *
 * 4. **Transformation Functions**:
 *    - transformRoute: NEAR Intents Route → Provider Route (for middleware)
 *    - transformAsset: Provider Asset → NEAR Intents Asset (for responses)
 *
 * Workflow:
 * Client Request (NEAR Intents) → Middleware (transformRoute) → Service (Provider format)
 * Service Response (Provider format) → Router (transformAsset) → Client Response (NEAR Intents)
 */
/**
 * NEAR Intents Data Provider Plugin
 *
 * Provides market data for NEAR Intents cross-chain swaps using:
 * - 1Click API for assets, rates, liquidity
 * - Intents Explorer API for historical volumes
 *
 * No API key required - works with optional JWT for authenticated endpoints.
 */
export default createPlugin({
  variables: z.object({
    oneClickBaseUrl: z.string().url().default("https://1click.chaindefuser.com"),
    explorerBaseUrl: z.string().url().default("https://explorer.near-intents.org"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
    apiKey: z.string().optional(), // JWT for 1Click and Explorer APIs
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create HTTP client for both APIs
      const client = new ProviderApiClient(
        config.variables.oneClickBaseUrl,
        config.variables.explorerBaseUrl,
        config.secrets.apiKey,
        config.variables.timeout
      );

      // Create service instance
      const service = new DataProviderService(client);

      // NEAR Intents → Provider (for middleware/requests)
      // Since 1Click uses NEAR Intents asset format, transform is direct mapping
      const transformAssetToProvider = async (asset: AssetType): Promise<ProviderAssetType> => ({
        blockchain: asset.blockchain,
        assetId: asset.assetId,
        symbol: asset.symbol,
        decimals: asset.decimals,
        contractAddress: asset.contractAddress,
      });

      // Provider → NEAR Intents (for responses)
      // Direct passthrough since both use same format, but normalize contractAddress
      const transformAssetFromProvider = async (asset: ProviderAssetType): Promise<AssetType> => {
        const contractAddress = asset.contractAddress
          ?? asset.assetId.split(':').slice(1).join(':') // Derive from assetId (nep141:blockchain-addr)
          ?? asset.assetId; // Final fallback

        return {
          blockchain: asset.blockchain,
          assetId: asset.assetId,
          symbol: asset.symbol,
          decimals: asset.decimals,
          contractAddress,
        };
      };

      return { service, transformAssetToProvider, transformAssetFromProvider };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service, transformAssetToProvider, transformAssetFromProvider } = context;

    // Create typed middleware from builder
    const transformRoutesMiddleware = createTransformRoutesMiddleware<
      AssetType,
      ProviderAssetType
    >(transformAssetToProvider);

    return {
      // Individual routes - expect service format
      getVolumes: builder.getVolumes.handler(async ({ input }) => {
        const volumes = await service.getVolumes(input.includeWindows || ["24h"]);
        return { volumes };
      }),

      getListedAssets: builder.getListedAssets.handler(async () => {
        const providerAssets = await service.getListedAssets();

        const assets = await Promise.all(
          providerAssets.map(asset => transformAssetFromProvider(asset))
        );

        return {
          assets,
          measuredAt: new Date().toISOString()
        };
      }),

      getRates: builder.getRates.use(transformRoutesMiddleware).handler(async ({ input, context }) => {
        const providerRates = await service.getRates(context.routes, input.notionals);
        const rates = await Promise.all(
          providerRates.map(r => transformRate(r, transformAssetFromProvider))
        );
        return { rates };
      }),

      getLiquidity: builder.getLiquidity.use(transformRoutesMiddleware).handler(async ({ input, context }) => {
        const providerLiquidity = await service.getLiquidityDepth(context.routes);
        const liquidity = await Promise.all(
          providerLiquidity.map(l => transformLiquidity(l, transformAssetFromProvider))
        );
        return { liquidity };
      }),

      // Composite route - with middleware, accepts and returns NEAR Intents format
      getSnapshot: builder.getSnapshot
        .use(transformRoutesMiddleware)
        .handler(async ({ input, context }) => {
          const providerSnapshot = await service.getSnapshot({
            routes: context.routes,
            notionals: input.notionals,
            includeWindows: input.includeWindows
          });

          // Transform all nested provider types to NEAR Intents format
          const [rates, liquidity, assets] = await Promise.all([
            providerSnapshot.rates
              ? Promise.all(providerSnapshot.rates.map(r => transformRate(r, transformAssetFromProvider)))
              : undefined,
            providerSnapshot.liquidity
              ? Promise.all(providerSnapshot.liquidity.map(l => transformLiquidity(l, transformAssetFromProvider)))
              : undefined,
            Promise.all(providerSnapshot.listedAssets.assets.map(transformAssetFromProvider))
          ]);

          return {
            volumes: providerSnapshot.volumes,
            listedAssets: { assets, measuredAt: providerSnapshot.listedAssets.measuredAt },
            ...(rates && { rates }),
            ...(liquidity && { liquidity })
          };
        }),

      ping: builder.ping.handler(async () => {
        return {
          status: "ok" as const,
          timestamp: new Date().toISOString(),
        };
      }),
    };
  }
});
