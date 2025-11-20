import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { parse1cs, stringify1cs } from "@defuse-protocol/crosschain-assetid";

import { createTransformRoutesMiddleware, getBlockchainFromChainId, getChainId, transformRate, transformLiquidity, getChainNamespace } from "@data-provider/plugin-utils";
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
      
      // Prefetch and cache token list for asset resolution
      const tokenList = yield* Effect.tryPromise({
        try: () => service.getListedAssets(),
        catch: (error) => new Error(`Failed to fetch token list: ${error}`)
      });
      
      // Build lookup indices for fast asset resolution
      const assetByExactId = new Map(
        tokenList.map(t => [t.assetId, t])
      );
      
      const assetByBlockchainAndAddress = new Map(
        tokenList
          .filter(t => t.contractAddress) // Filter out undefined
          .map(t => [`${t.blockchain}:${t.contractAddress!.toLowerCase()}`, t])
      );

      // NEAR Intents → Provider (for middleware/requests)
      // Handles both 1cs_v1 and legacy NEAR asset IDs
      const transformAssetToProvider = async (asset: AssetType): Promise<ProviderAssetType> => {
        // Strategy 1: Try exact assetId match (1Click may already use 1cs_v1 or have canonical IDs)
        const exactMatch = assetByExactId.get(asset.assetId);
        if (exactMatch) {
          console.log(`[NEAR Intents] Resolved asset via exact ID: ${asset.assetId}`);
          return exactMatch;
        }

        // Strategy 2: If assetId is 1cs_v1, parse it and try to match components
        if (asset.assetId.startsWith('1cs_v1:')) {
          try {
            const parsed = parse1cs(asset.assetId);
            
            // Try to find token by matching parsed components with token metadata
            // For ERC20: chain=eth/arb/etc, namespace=erc20, reference=0xAddress
            // Look up by blockchain + reference (contract address)
            const blockchainKey = `${parsed.chain}:${parsed.reference.toLowerCase()}`;
            const matchByParsed = assetByBlockchainAndAddress.get(blockchainKey);
            
            if (matchByParsed) {
              console.log(`[NEAR Intents] Resolved 1cs_v1 asset via parsed components: ${asset.assetId} -> ${matchByParsed.assetId}`);
              return matchByParsed;
            }
          } catch (error) {
            console.warn(`[NEAR Intents] Failed to parse 1cs_v1 ID: ${asset.assetId}`, error);
          }
        }

        // Strategy 3: Fallback to blockchain + contractAddress matching
        const fallbackKey = `${asset.blockchain}:${asset.contractAddress.toLowerCase()}`;
        const fallbackMatch = assetByBlockchainAndAddress.get(fallbackKey);
        if (fallbackMatch) {
          console.log(`[NEAR Intents] Resolved asset via blockchain+address: ${fallbackKey} -> ${fallbackMatch.assetId}`);
          return fallbackMatch;
        }

        // Strategy 4: No match found - return as-is and let 1Click API handle/reject it
        console.warn(`[NEAR Intents] Could not resolve asset in token list, passing through: ${asset.assetId}`);
        return {
          blockchain: asset.blockchain,
          assetId: asset.assetId,
          symbol: asset.symbol,
          decimals: asset.decimals,
          contractAddress: asset.contractAddress,
        };
      };

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

        const assetMap = new Map<string, AssetType>();

        for (const asset of providerAssets) {
          try {
            let canonical: string;

            if (asset.assetId.startsWith('1cs_v1:')) {
              canonical = asset.assetId;
            } else {
              const { namespace, reference } = getChainNamespace(
                asset.blockchain,
                asset.contractAddress
              );
              canonical = stringify1cs({
                version: 'v1',
                chain: asset.blockchain,
                namespace,
                reference: reference.toLowerCase()
              });
            }

            if (!assetMap.has(canonical)) {
              const parsed = parse1cs(canonical);
              assetMap.set(canonical, {
                blockchain: asset.blockchain,
                assetId: canonical,
                symbol: asset.symbol,
                decimals: asset.decimals,
                contractAddress: asset.contractAddress || parsed.reference
              });
            }
          } catch (error) {
            console.warn(`[NEAR Intents] Failed to convert asset ${asset.symbol} (blockchain: ${asset.blockchain}):`, error);
          }
        }

        return {
          assets: Array.from(assetMap.values()),
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
