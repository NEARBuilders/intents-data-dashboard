import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { fromUniswapToken, parse1cs, stringify1cs } from "@defuse-protocol/crosschain-assetid";

import { createTransformRoutesMiddleware, getBlockchainFromChainId, getChainId, transformLiquidity, transformRate, getChainNamespace } from "@data-provider/plugin-utils";
import type { AssetType } from "@data-provider/shared-contract";
import type { AcrossAssetType } from "./contract";
import { contract } from "./contract";
import { AcrossService } from "./service";

/**
 * Across Protocol Data Provider Plugin
 *
 * Collects real-time data from Across Protocol including:
 * - Bridge volumes (24h, 7d, 30d) from DefiLlama
 * - Rate quotes with accurate fees from Across API
 * - Liquidity depth based on deposit limits
 * - Supported assets across all chains
 *
 * No API key required - Across API is public.
 */
export default createPlugin({
  variables: z.object({
    baseUrl: z.string().url().default("https://app.across.to/api"),
    timeout: z.number().min(1000).max(60000).default(30000),
  }),

  secrets: z.object({
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      // Create service instance with config
      const service = new AcrossService(
        config.variables.baseUrl,
        config.variables.timeout,
      );

      // NEAR Intents → Provider (for middleware/requests)
      const transformAssetToProvider = async (asset: AssetType): Promise<AcrossAssetType> => {
        const chainId = await getChainId(asset.blockchain);

        return {
          chainId: chainId!,
          address: asset.contractAddress,
          symbol: asset.symbol,
          decimals: asset.decimals
        };
      };

      // Provider → NEAR Intents (for responses)
      const transformAssetFromProvider = async (asset: AcrossAssetType): Promise<AssetType> => {
        let blockchain = await getBlockchainFromChainId(asset.chainId.toString());

        if (!blockchain) {
          // Handle known chainIds that may not be in chainlist
          switch (asset.chainId) {
            case 34268394551451: { // Solana
              blockchain = "sol";
              break;
            }
            default: {
              throw new Error(`Unknown chainId: ${asset.chainId} for asset ${asset.symbol} (${asset.address})`);
            }
          }
        }

        const assetId = asset.address ? `nep141:${blockchain}-${asset.address.toLowerCase()}.omft.near` : `nep141:${asset.symbol}`;

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
      AcrossAssetType
    >(transformAssetToProvider);

    return {
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
            let blockchain: string | null;

            try {
              canonical = fromUniswapToken({
                chainId: asset.chainId,
                address: asset.address.toLowerCase()
              });
              const parsed = parse1cs(canonical);
              blockchain = parsed.chain;
            } catch (error) {
              blockchain = await getBlockchainFromChainId(asset.chainId.toString());
              
              if (!blockchain) {
                if (asset.chainId === 34268394551451) {
                  blockchain = "sol";
                } else {
                  console.warn(`[Across] Skipping asset ${asset.symbol} - unknown chainId: ${asset.chainId}`);
                  continue;
                }
              }

              const { namespace, reference } = getChainNamespace(blockchain, asset.address);
              canonical = stringify1cs({
                version: 'v1',
                chain: blockchain,
                namespace,
                reference: reference.toLowerCase()
              });
            }

            if (!assetMap.has(canonical)) {
              assetMap.set(canonical, {
                blockchain,
                assetId: canonical,
                symbol: asset.symbol,
                decimals: asset.decimals,
                contractAddress: asset.address.toLowerCase()
              });
            }
          } catch (error) {
            console.warn(`[Across] Failed to convert asset ${asset.symbol} (chainId: ${asset.chainId}, address: ${asset.address}):`, error);
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

      getSnapshot: builder.getSnapshot.use(transformRoutesMiddleware).handler(async ({ input, context }) => {
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
