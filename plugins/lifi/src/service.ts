import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain } from '@data-provider/plugin-utils';
import Decimal from 'decimal.js';
import { LiFiApiClient, LiFiAssetType } from './client';

import type {
  AssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * Data Provider Service for Li.Fi
 *
 * Li.Fi is a cross-chain bridge aggregator.
 *
 * Key features:
 * - Multi-chain token support
 * - Analytics API for volume metrics
 * - Binary search for liquidity estimation
 * - Quote API for rates
 */
export class LiFiService extends BaseDataProviderService<LiFiAssetType> {
  constructor(
    private readonly client: LiFiApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<LiFiAssetType> {
    const identity = await assetToCanonicalIdentity(asset);
    const chainId = getChainIdFromBlockchain(identity.blockchain);

    if (!chainId) {
      throw new Error(`Unable to resolve chain for asset: ${identity.assetId}`);
    }

    return {
      chainId: chainId.toString(),
      address: identity.reference,
      symbol: asset.symbol,
      decimals: asset.decimals
    };
  }

  /**
   * Transform provider-specific asset to canonical AssetType format.
   */
  async transformAssetFromProvider(asset: LiFiAssetType): Promise<AssetType> {
    const identity = await assetToCanonicalIdentity({
      chainId: parseInt(asset.chainId, 10),
      address: asset.address
    });

    return canonicalToAsset(identity, {
      symbol: asset.symbol,
      decimals: asset.decimals
    });
  }

  /**
   * Fetch volume metrics from Li.Fi analytics API.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    if (!windows?.length) {
      return [];
    }

    const volumes: VolumeWindowType[] = [];
    const now = Math.floor(Date.now() / 1000);

    const windowDurations: Record<string, number> = {
      "24h": 24 * 60 * 60,
      "7d": 7 * 24 * 60 * 60,
      "30d": 30 * 24 * 60 * 60,
    };

    for (const window of windows) {
      try {
        const duration = windowDurations[window];
        if (!duration) {
          console.warn(`[Li.Fi] Unknown window: ${window}`);
          continue;
        }

        const fromTimestamp = now - duration;
        let totalVolume = new Decimal(0);
        let cursor: string | undefined = undefined;
        let hasMore = true;
        let pageCount = 0;
        const MAX_PAGES_PER_WINDOW = 8;
        const LIMIT_PER_PAGE = 1000;

        console.log(`[Li.Fi] [${window}] Fetching from v2 endpoint...`);

        while (hasMore && pageCount < MAX_PAGES_PER_WINDOW) {
          try {
            const response = await this.client.fetchTransfers({
              status: "DONE",
              fromTimestamp: String(fromTimestamp),
              toTimestamp: String(now),
              limit: String(LIMIT_PER_PAGE),
              ...(cursor && { next: cursor })
            });

            const transfersList = response?.data || response?.transfers || [];

            if (Array.isArray(transfersList)) {
              for (const transfer of transfersList) {
                const amount = new Decimal(transfer.receiving?.amountUSD || "0");
                totalVolume = totalVolume.plus(amount);
              }
            }

            hasMore = response?.hasNext === true;
            cursor = response?.next;
            pageCount++;

            console.log(`[Li.Fi]   [page ${pageCount}] ${transfersList.length} transfers, cumulative: $${totalVolume.toNumber()}`);

            if (hasMore && pageCount < MAX_PAGES_PER_WINDOW) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (pageError) {
            console.warn(`[Li.Fi]   [page ${pageCount}] Error:`,
              pageError instanceof Error ? pageError.message : "Unknown error");
            if (pageCount === 0) {
              throw pageError;
            }
            hasMore = false;
            console.log(`[Li.Fi]   Stopped at page ${pageCount}, using partial data`);
          }
        }

        console.log(`[Li.Fi] ✓ [${window}] Volume: $${totalVolume.toNumber()} from ${pageCount} pages`);

        volumes.push({
          window,
          volumeUsd: totalVolume.toNumber(),
          measuredAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[Li.Fi] Failed to fetch volume for window ${window}:`,
          error instanceof Error ? error.message : "Unknown error");
        return windows.map(window => ({
          window,
          volumeUsd: 0,
          measuredAt: new Date().toISOString()
        }));
      }
    }

    return volumes;
  }

  /**
   * Fetch list of assets supported by Li.Fi.
   */
  async getListedAssets(): Promise<LiFiAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

      if (!tokens?.tokens || typeof tokens.tokens !== 'object') {
        throw new Error('Invalid tokens response structure');
      }

      const assets: LiFiAssetType[] = [];

      Object.entries(tokens.tokens).forEach(([chainId, chainTokens]) => {
        if (!Array.isArray(chainTokens)) {
          console.warn(`[Li.Fi] Invalid token list for chain ${chainId}`);
          return;
        }

        chainTokens.forEach(token => {
          if (!token?.address || !token?.symbol || typeof token.decimals !== 'number') {
            console.warn('[Li.Fi] Invalid token structure, skipping token');
            return;
          }

          assets.push({
            chainId,
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          });
        });
      });

      console.log(`[Li.Fi] Loaded ${assets.length} assets from API`);
      return assets;
    } catch (error) {
      throw new Error(`Failed to fetch Li.Fi tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch rate quotes for route with specific amount.
   */
  async getRates(
    route: RouteType<LiFiAssetType>,
    amount: string
  ): Promise<RateType<LiFiAssetType>[]> {
    if (!route?.source || !route?.destination) {
      console.warn('[Li.Fi] Invalid route structure, skipping');
      return [];
    }

    if (!amount || isNaN(Number(amount))) {
      console.warn(`[Li.Fi] Invalid amount ${amount}, skipping`);
      return [];
    }

    const rates: RateType<LiFiAssetType>[] = [];

    try {
      const quote = await this.client.fetchQuote({
        fromChain: parseInt(route.source.chainId, 10),
        toChain: parseInt(route.destination.chainId, 10),
        fromToken: route.source.address,
        toToken: route.destination.address,
        fromAmount: amount
      });

      if (!quote?.estimate) {
        throw new Error('Invalid quote response structure');
      }

      const effectiveRate = calculateEffectiveRate(
        quote.estimate.fromAmount,
        quote.estimate.toAmount,
        route.source.decimals,
        route.destination.decimals
      );

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn: quote.estimate.fromAmount,
        amountOut: quote.estimate.toAmount,
        effectiveRate,
        quotedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Li.Fi] Failed to get rate for route:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return rates;
  }

  /**
   * Probe liquidity depth using binary search.
   */
  async getLiquidityDepth(
    route: RouteType<LiFiAssetType>
  ): Promise<LiquidityDepthType<LiFiAssetType>[]> {
    if (!route?.source || !route?.destination) {
      console.warn('[Li.Fi] Invalid route structure for liquidity probing, skipping');
      return [];
    }

    const liquidity: LiquidityDepthType<LiFiAssetType>[] = [];

    try {
      const thresholds = [];

      for (const slippageBps of [50, 100]) {
        try {
          const slippage = slippageBps / 10000;

          let minAmount = new Decimal('1000000');
          let maxAmount = new Decimal('100000000000');
          let bestAmount = minAmount;

          for (let i = 0; i < 3; i++) {
            const testAmount = minAmount.plus(maxAmount).div(2);

            try {
              await this.client.fetchQuote({
                fromChain: parseInt(route.source.chainId, 10),
                toChain: parseInt(route.destination.chainId, 10),
                fromToken: route.source.address,
                toToken: route.destination.address,
                fromAmount: testAmount.toString(),
                slippage: slippage.toString()
              });

              bestAmount = testAmount;
              minAmount = testAmount;
            } catch {
              maxAmount = testAmount;
            }

            if (maxAmount.minus(minAmount).div(minAmount).lt(0.1)) {
              break;
            }
          }

          thresholds.push({
            maxAmountIn: bestAmount.toString(),
            slippageBps,
          });
        } catch (error) {
          throw new Error(`Liquidity probing failed for ${slippageBps}bps: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (thresholds.length > 0) {
        liquidity.push({
          route,
          thresholds,
          measuredAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[Li.Fi] Failed to get liquidity for route:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    return liquidity;
  }
}
