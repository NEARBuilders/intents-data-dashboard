import { DataProviderService as BaseDataProviderService, calculateEffectiveRate } from "@data-provider/plugin-utils";
import { ProviderApiClient } from "./client";
import { QuoteRequest } from "@defuse-protocol/one-click-sdk-typescript";
import type {
  LiquidityDepthType,
  ProviderAssetType,
  RateType,
  RouteType,
  SnapshotType,
  TimeWindow,
  VolumeWindowType
} from "./contract";

/**
 * Service Layer for Data Provider Business Logic
 *
 * This layer implements the core business logic for interacting with data provider APIs.
 * Key characteristics:
 * - Works exclusively in provider-specific format (ProviderAssetType, ProviderRouteType)
 * - No knowledge of NEAR Intents format - that's handled by the router layer
 * - Each method maps directly to a provider API endpoint
 * - Returns standardized internal types with generic provider asset types
 *
 * Architecture Flow:
 * Client Input (NEAR Intents) → Router (transformRoute) → Service (Provider format) → API Response
 * API Response → Service (standardize) → Router (transformAsset) → Client Output (NEAR Intents)
 */
export class DataProviderService extends BaseDataProviderService<ProviderAssetType> {
  constructor(private readonly client: ProviderApiClient) {
    super();
  }

  /**
   * Fetch volume metrics for specified time windows using Intents Explorer API.
   * Aggregates successful transactions to get global NEAR Intents volume.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    const now = new Date();
    const volumes: VolumeWindowType[] = [];

    for (const window of windows) {
      let volumeUsd = 0;
      let page = 1;

      // Calculate start timestamp in seconds
      const windowDurationSec = window === "24h" ? 24 * 60 * 60 :
        window === "7d" ? 7 * 24 * 60 * 60 :
          30 * 24 * 60 * 60;
      const startTimestamp = Math.floor(now.getTime() / 1000) - windowDurationSec;

      try {
        // Paginate through all transactions in the time window
        while (true) {
          const response = await this.client.fetchTransactionsPage({
            page,
            startTimestamp,
            statuses: 'SUCCESS'
          });

          // Sum up USD values from successful transactions
          for (const tx of response.data) {
            const usdAmount = parseFloat(tx.amountInUsd || tx.amountOutUsd || '0');
            if (usdAmount > 0) {
              volumeUsd += usdAmount;
            }
          }

          // Check if we have more pages
          if (response.nextPage === null) {
            break;
          }
          page = response.nextPage;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now.toISOString()
        });
      } catch (error) {
        console.error(`[NEAR Intents] Failed to fetch volume for ${window}:`, error);
        // Return zero volume for this window on error
        volumes.push({
          window,
          volumeUsd: 0,
          measuredAt: now.toISOString()
        });
      }
    }

    return volumes;
  }

  /**
   * Fetch list of assets supported by NEAR Intents using 1Click API.
   */
  async getListedAssets(): Promise<ProviderAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

      // Map 1Click TokenResponse to ProviderAssetType
      // Deduplicate by (blockchain, assetId) to avoid duplicates
      const assetMap = new Map<string, ProviderAssetType>();

      for (const token of tokens) {
        const key = `${token.blockchain}:${token.assetId}`;

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            blockchain: token.blockchain,
            assetId: token.assetId,
            symbol: token.symbol,
            decimals: token.decimals,
            contractAddress: token.contractAddress,
            price: token.price,
            priceUpdatedAt: token.priceUpdatedAt
          });
        }
      }

      console.log(`[NEAR Intents] Deduplicated ${tokens.length} tokens from 1Click to ${assetMap.size} unique assets`);
      return Array.from(assetMap.values());

    } catch (error) {
      console.error("[NEAR Intents] Failed to fetch tokens from 1Click:", error);
      return [];
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations using 1Click API.
   */
  async getRates(routes: RouteType<ProviderAssetType>[], notionals: string[]): Promise<RateType<ProviderAssetType>[]> {
    const rates: RateType<ProviderAssetType>[] = [];

    for (const route of routes) {
      for (const notional of notionals) {
        try {
          // Build quote request for dry-run mode
          const quoteRequest: QuoteRequest = {
            dry: true,
            swapType: QuoteRequest.swapType.EXACT_INPUT,
            slippageTolerance: 100, // 1%
            originAsset: route.source.assetId,
            depositType: QuoteRequest.depositType.INTENTS,
            destinationAsset: route.destination.assetId,
            amount: notional,
            refundTo: 'recipient.near', // dummy valid recipient
            refundType: QuoteRequest.refundType.INTENTS,
            recipient: 'recipient.near',
            recipientType: QuoteRequest.recipientType.INTENTS,
            deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
          };

          const response = await this.client.fetchQuote(quoteRequest);

          // Extract quote data
          const quote = response.quote;
          const amountIn = quote.amountIn;
          const amountOut = quote.amountOut;
          const amountInUsd = quote.amountInUsd;
          const amountOutUsd = quote.amountOutUsd;

          // Calculate effective rate and fees
          const effectiveRate = calculateEffectiveRate(
            amountIn,
            amountOut,
            route.source.decimals,
            route.destination.decimals
          );

          const totalFeesUsd = (amountInUsd && amountOutUsd)
            ? Math.max(0, parseFloat(amountInUsd) - parseFloat(amountOutUsd))
            : null;

          rates.push({
            source: route.source,
            destination: route.destination,
            amountIn,
            amountOut,
            effectiveRate,
            totalFeesUsd,
            quotedAt: response.timestamp || new Date().toISOString(),
          });
        } catch (error) {
          console.error(`[NEAR Intents] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
          // Skip this route/notional pair but continue with others
        }
      }
    }

    console.log(`[NEAR Intents] Successfully fetched ${rates.length} rates for ${routes.length} routes`);
    return rates;
  }

  /**
   * Fetch liquidity depth at 50bps and 100bps thresholds.
   * Estimates depth by requesting quotes at various notional sizes and measuring slippage.
   */
  async getLiquidityDepth(routes: RouteType<ProviderAssetType>[]): Promise<LiquidityDepthType<ProviderAssetType>[]> {
    const liquidity: LiquidityDepthType<ProviderAssetType>[] = [];

    for (const route of routes) {
      try {
        // Define candidate notionals to test for liquidity
        // Use a range similar to testNotionals but extended
        const candidateNotionals = [
          '100000000',      // $100 for 6-decimal tokens
          '1000000000',     // $1K
          '10000000000',    // $10K
          '100000000000',   // $100K
          '1000000000000',  // $1M
        ];

        // Get baseline rate from smallest notional
        const baselineAmount = candidateNotionals[0]!;
        const baselineResponse = await this.client.fetchQuote({
          dry: true,
          swapType: QuoteRequest.swapType.EXACT_INPUT,
          slippageTolerance: 100, // 1%
          originAsset: route.source.assetId,
          depositType: QuoteRequest.depositType.INTENTS,
          destinationAsset: route.destination.assetId,
          amount: baselineAmount,
          refundTo: 'recipient.near',
          refundType: QuoteRequest.refundType.INTENTS,
          recipient: 'recipient.near',
          recipientType: QuoteRequest.recipientType.INTENTS,
          deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });

        const baselineRate = calculateEffectiveRate(
          baselineResponse.quote.amountIn,
          baselineResponse.quote.amountOut,
          route.source.decimals,
          route.destination.decimals
        );

        // Find max amounts at 50bps and 100bps slippage
        let maxAmount50bps: string | undefined;
        let maxAmount100bps: string | undefined;

        for (const notional of candidateNotionals) {
          try {
            const response = await this.client.fetchQuote({
              dry: true,
              swapType: QuoteRequest.swapType.EXACT_INPUT,
              slippageTolerance: 100, // 1%
              originAsset: route.source.assetId,
              depositType: QuoteRequest.depositType.INTENTS,
              destinationAsset: route.destination.assetId,
              amount: notional,
              refundTo: 'recipient.near',
              refundType: QuoteRequest.refundType.INTENTS,
              recipient: 'recipient.near',
              recipientType: QuoteRequest.recipientType.INTENTS,
              deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            });

            const currentRate = calculateEffectiveRate(
              response.quote.amountIn,
              response.quote.amountOut,
              route.source.decimals,
              route.destination.decimals
            );

            const slippageBps = Math.abs(currentRate / baselineRate - 1) * 10000;

            if (slippageBps <= 50 && (!maxAmount50bps || parseFloat(notional) > parseFloat(maxAmount50bps))) {
              maxAmount50bps = notional;
            }
            if (slippageBps <= 100 && (!maxAmount100bps || parseFloat(notional) > parseFloat(maxAmount100bps))) {
              maxAmount100bps = notional;
            }
          } catch (error) {
            // Skip this notional size if quote fails
            console.error(`[NEAR Intents] Quote failed for liquidity test at amount ${notional}:`, error);
          }
        }

        // Build thresholds array - may be empty if no quotes succeeded
        const thresholds = [];
        if (maxAmount50bps) {
          thresholds.push({
            maxAmountIn: maxAmount50bps,
            slippageBps: 50,
          });
        }
        if (maxAmount100bps) {
          thresholds.push({
            maxAmountIn: maxAmount100bps,
            slippageBps: 100,
          });
        }

        liquidity.push({
          route,
          thresholds,
          measuredAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[NEAR Intents] Failed to fetch liquidity for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
        // Still add an entry with empty thresholds to maintain structure
        liquidity.push({
          route,
          thresholds: [],
          measuredAt: new Date().toISOString(),
        });
      }
    }

    console.log(`[NEAR Intents] Successfully measured liquidity for ${liquidity.length} routes`);
    return liquidity;
  }

  /**
 * Get complete snapshot of provider data for given provider-formatted routes and notionals.
 * This is a coordinator method that calls the individual methods.
 * Returns provider format - transformation to NEAR Intents happens in router layer.
 */
  async getSnapshot(params: {
    routes: RouteType<ProviderAssetType>[];
    notionals?: string[];
    includeWindows?: TimeWindow[];
  }): Promise<SnapshotType<ProviderAssetType>> {
    const [volumes, listedAssets, rates, liquidity] = await Promise.all([
      this.getVolumes(params.includeWindows || ["24h"]),
      this.getListedAssets(),
      params.notionals ? this.getRates(params.routes, params.notionals) : Promise.resolve([]),
      this.getLiquidityDepth(params.routes)
    ]);

    return {
      volumes,
      listedAssets: {
        assets: listedAssets,
        measuredAt: new Date().toISOString()
      },
      ...(rates.length > 0 && { rates }),
      ...(liquidity.length > 0 && { liquidity }),
    };
  }
}
