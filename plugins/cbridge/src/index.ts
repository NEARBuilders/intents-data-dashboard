import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import {
  createTransformRoutesMiddleware,
  getBlockchainFromChainId,
  getChainId,
  transformRate,
  transformLiquidity
} from "@data-provider/plugin-utils";

import { CBridgeApiClient, DefiLlamaApiClient } from "./client";
import { contract } from "./contract";
import { CBridgeService } from "./service";
import type { AssetType, CBridgeAssetType } from "./contract";

export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://cbridge-prod2.celer.app"),
    defillamaBaseUrl: z.string().url().default("https://bridges.llama.fi"), // Use as constant
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
    apiKey: z.string().default(""),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create HTTP clients
      const cBridgeClient = new CBridgeApiClient(
        config.variables.baseUrl,
        config.secrets.apiKey,
        config.variables.timeout
      );

      const defillamaClient = new DefiLlamaApiClient(config.variables.timeout);

      // Create service
      const service = new CBridgeService(cBridgeClient, defillamaClient);

      // NEAR Intents → cBridge transformation
      const transformAssetToProvider = async (asset: AssetType): Promise<CBridgeAssetType> => {
        const chainId = await getChainId(asset.blockchain);
        if (!chainId) {
          throw new Error(`Unsupported blockchain: ${asset.blockchain}`);
        }
        return {
          chainId,
          address: asset.contractAddress!,
          symbol: asset.symbol,
          decimals: asset.decimals
        };
      };

      // cBridge → NEAR Intents transformation
      const transformAssetFromProvider = async (asset: CBridgeAssetType): Promise<AssetType> => {
        let blockchain = await getBlockchainFromChainId(String(asset.chainId));

        if (!blockchain) {
          // Handle provider-specific or unknown chain mappings
          switch (asset.chainId) {
            // Common chains that might not be in standard mapping
            case 1990: // Elrond/MultiversX testnet
            case 1991: // Elrond mainnet
              console.warn(`Skipping unsupported Elrond chainId: ${asset.chainId} for ${asset.symbol}`);
              throw new Error(`Unsupported chainId: ${asset.chainId}`); // Skip this asset
            // Add more cases here as needed for specific chains

            default:
              // Log and skip unknown chains instead of throwing
              console.warn(`Unsupported chainId: ${asset.chainId} for ${asset.symbol}, skipping asset`);
              throw new Error(`Unsupported chainId: ${asset.chainId}`);
          }
        }

        const assetId = asset.address
          ? `nep141:${blockchain}-${asset.address.toLowerCase()}.omft.near`
          : `nep141:${asset.symbol}`;

        return {
          blockchain,
          assetId,
          symbol: asset.symbol,
          decimals: asset.decimals,
          contractAddress: asset.address
        };
      };

      return { service, transformAssetToProvider, transformAssetFromProvider };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service, transformAssetToProvider, transformAssetFromProvider } = context;

    // Create middleware for route transformation
    const transformRoutesMiddleware = createTransformRoutesMiddleware<
      AssetType,
      CBridgeAssetType
    >(transformAssetToProvider);

    return {
      // No middleware - works with standard inputs
      getVolumes: builder.getVolumes.handler(async ({ input }) => {
        const volumes = await service.getVolumes(input.includeWindows || ["24h"]);
        return { volumes };
      }),

      // No middleware - transforms provider assets to NEAR Intents
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

      // WITH middleware - accepts NEAR Intents, transforms to provider format
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

      ping: builder.ping.handler(async () => ({
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      })),
    };
  }
});
