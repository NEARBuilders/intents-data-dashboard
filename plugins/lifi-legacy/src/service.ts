import { calculateEffectiveRate, createHttpClient, createRateLimiter } from '@data-provider/plugin-utils';
import type {
  AssetType,
  LiquidityDepthType,
  ListedAssetsType,
  ProviderSnapshotType,
  RateType,
  VolumeWindowType
} from '@data-provider/shared-contract';
import Decimal from "decimal.js";
import { Effect } from "every-plugin/effect";

interface LiFiToken {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

interface LiFiQuote {
  estimate: {
    fromAmount: string;
    toAmount: string;
    feeCosts: Array<{ amount: string; amountUSD?: string }>;
  };
}

interface LiFiTransfer {
  receiving: {
    amount: string;
    amountUSD?: string;
    token: {
      address: string;
      chainId: number;
      symbol: string;
    };
  };
  tool: string;
  status: string;
  timestamp: number;
}

interface LiFiTransfersResponse {
  data?: LiFiTransfer[];
  transfers?: LiFiTransfer[];
  hasNext?: boolean;
  next?: string;
}

/**
 * Li.Fi Data Provider Service - Collects cross-chain bridge metrics from Li.Fi API.
 */
export class DataProviderService {
  // Simple in-memory cache for volumes (1 hour TTL - reduce API calls)
  private volumeCache: Map<string, { data: VolumeWindowType[]; timestamp: number }> = new Map();
  private readonly VOLUME_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private http: ReturnType<typeof createHttpClient>;
  private analyticsHttp: ReturnType<typeof createHttpClient>;

  constructor(
    private readonly baseUrl: string,
    maxRequestsPerSecond: number = 10
  ) {
    // Initialize HTTP clients with rate limiting
    this.http = createHttpClient({
      baseUrl: this.baseUrl,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: 10000, // 10 second timeout
      retries: 1 // Single retry as per Li.Fi config
    });

    // Separate client for v2 analytics endpoint
    this.analyticsHttp = createHttpClient({
      baseUrl: this.baseUrl.replace('/v1', '/v2'),
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: 10000,
      retries: 1
    });
  }



  /**
   * Get complete snapshot of provider data for given routes and notionals.
   *
   * This method coordinates fetching:
   * - Volume metrics for specified time windows
   * - Rate quotes for each route/notional combination
   * - Liquidity depth at 50bps and 100bps thresholds
   * - List of supported assets
   */
  getSnapshot(params: {
    routes?: Array<{ source: AssetType; destination: AssetType }>;
    notionals?: string[];
    includeWindows?: Array<"24h" | "7d" | "30d">;
  }) {

    return Effect.tryPromise({
      try: async () => {
        const hasRoutes = params.routes && params.routes.length > 0;
        const hasNotionals = params.notionals && params.notionals.length > 0;

        try {
          const [volumes, rates, liquidity, listedAssets] = await Promise.all([
            this.getVolumes(params.includeWindows || ["24h"]),
            hasRoutes && hasNotionals ? this.getRates(params.routes!, params.notionals!) : Promise.resolve([]),
            hasRoutes ? this.getLiquidityDepth(params.routes!) : Promise.resolve([]),
            this.getListedAssets()
          ]);

          return {
            volumes,
            rates,
            liquidity,
            listedAssets,
          } satisfies ProviderSnapshotType;
        } catch (error) {
          throw new Error(`Snapshot fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      catch: (error: unknown) =>
        new Error(`Failed to fetch snapshot: ${error instanceof Error ? error.message : String(error)}`)
    });
  }

  /**
   * Get aggregated volume metrics for specified time windows.
   * 
   * Uses Li.Fi's GET /v2/analytics/transfers endpoint to aggregate cross-chain transfer volumes.
   * This endpoint returns actual transaction data from Li.Fi's routing records.
   * 
   * Rate limits (unauthenticated): 200 requests per 2 hours
   * Rate limits (authenticated): 200 requests per minute
   * 
   * Implementation:
   * - Queries transfers for each time window (24h, 7d, 30d)
   * - Aggregates amountUSD from all DONE transfers
   * - Handles pagination for large datasets
   * - Returns empty array on error (graceful degradation)
   * 
   * See README "Volume Metrics Implementation" section for details.
   */
  private async getVolumes(windows: Array<"24h" | "7d" | "30d">): Promise<VolumeWindowType[]> {
    if (!windows?.length) {
      return [];
    }

    // Check cache first
    const cacheKey = windows.sort().join(",");
    const cached = this.volumeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.VOLUME_CACHE_TTL) {
      console.log(`✓ Using cached volumes for windows: ${cacheKey}`);
      return cached.data;
    }

    const volumes: VolumeWindowType[] = [];
    const now = Math.floor(Date.now() / 1000); // Unix timestamp

    // Time windows in seconds
    const windowDurations: Record<string, number> = {
      "24h": 24 * 60 * 60,
      "7d": 7 * 24 * 60 * 60,
      "30d": 30 * 24 * 60 * 60,
    };

    for (const window of windows) {
      try {
        const duration = windowDurations[window];
        if (!duration) {
          console.warn(`Unknown window: ${window}`);
          continue;
        }

        const fromTimestamp = now - duration;

        // Aggregate transfers for this window using V2 endpoint with pagination
        let totalVolume = new Decimal(0);
        let cursor: string | undefined = undefined;
        let hasMore = true;
        let pageCount = 0;
        const MAX_PAGES_PER_WINDOW = 8;
        const LIMIT_PER_PAGE = 1000;

        console.log(`[${window}] Fetching from v2 endpoint...`);

        while (hasMore && pageCount < MAX_PAGES_PER_WINDOW) {
          try {
            const response: LiFiTransfersResponse = await this.analyticsHttp.get<LiFiTransfersResponse>('/analytics/transfers', {
              params: {
                status: "DONE",
                fromTimestamp: String(fromTimestamp),
                toTimestamp: String(now),
                limit: String(LIMIT_PER_PAGE),
                ...(cursor && { next: cursor })
              }
            });

            // Handle both v1 (transfers) and v2 (data) response formats
            const transfersList = response?.data || response?.transfers || [];

            if (Array.isArray(transfersList)) {
              for (const transfer of transfersList) {
                // Sum USD amounts from receiving side (destination amount in USD)
                const amount = new Decimal(transfer.receiving?.amountUSD || "0");
                totalVolume = totalVolume.plus(amount);
              }
            }

            // Check if there's another page
            hasMore = response?.hasNext === true;
            cursor = response?.next;
            pageCount++;

            console.log(`  [page ${pageCount}] ${transfersList.length} transfers, cumulative: $${totalVolume.toNumber()}`);

            // Add delay between pagination requests to respect rate limits
            if (hasMore && pageCount < MAX_PAGES_PER_WINDOW) {
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms spacing between requests
            }
          } catch (pageError) {
            console.warn(`  [page ${pageCount}] Error:`,
              pageError instanceof Error ? pageError.message : "Unknown error");
            // If first page fails, propagate the error
            if (pageCount === 0) {
              throw pageError;
            }
            // Otherwise stop pagination and use partial data collected so far
            hasMore = false;
            console.log(`  Stopped at page ${pageCount}, using partial data`);
          }
        }

        console.log(`✓ [${window}] Volume: $${totalVolume.toNumber()} from ${pageCount} pages`);

        volumes.push({
          window,
          volumeUsd: totalVolume.toNumber(),
          measuredAt: new Date().toISOString(),
        });
    } catch (error) {
      console.error(`Failed to fetch volume for window ${window}:`,
        error instanceof Error ? error.message : "Unknown error");
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
    }

    // Cache the result
    this.volumeCache.set(cacheKey, { data: volumes, timestamp: Date.now() });
    return volumes;
  }

  /**
   * Fetch rate quotes from Li.Fi API
   */
  private async getRates(routes: Array<{ source: AssetType; destination: AssetType }>, notionals: string[]): Promise<RateType[]> {
    if (!routes?.length || !notionals?.length) {
      throw new Error('Routes and notionals are required for rate fetching');
    }

    const rates: RateType[] = [];

    for (const route of routes) {
      if (!route?.source || !route?.destination) {
        console.warn('Invalid route structure, skipping');
        continue;
      }

      for (const notional of notionals) {
        if (!notional || isNaN(Number(notional))) {
          console.warn(`Invalid notional ${notional}, skipping`);
          continue;
        }

        try {
          const quote = await this.http.get<LiFiQuote>('/quote', {
            params: {
              fromChain: route.source.chainId,
              toChain: route.destination.chainId,
              fromToken: route.source.assetId,
              toToken: route.destination.assetId,
              fromAmount: notional
            }
          });

          if (!quote?.estimate) {
            throw new Error('Invalid quote response structure');
          }

          const totalFeesUsd = quote.estimate.feeCosts?.reduce((sum, fee) => {
            return sum + (fee.amountUSD ? parseFloat(fee.amountUSD) : 0);
          }, 0) || 0;

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
            totalFeesUsd,
            quotedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to get rate for route:', { error: error instanceof Error ? error.message : 'Unknown error' });
          continue; // Skip failed quote, don't add fake data
        }
      }
    }

    return rates;
  }



  /**
   * Probe liquidity depth using binary search for accurate thresholds
   */
  private async getLiquidityDepth(routes: Array<{ source: AssetType; destination: AssetType }>): Promise<LiquidityDepthType[]> {
    if (!routes?.length) {
      throw new Error('Routes are required for liquidity depth calculation');
    }

    const liquidity: LiquidityDepthType[] = [];

    for (const route of routes) {
      if (!route?.source || !route?.destination) {
        console.warn('Invalid route structure for liquidity probing, skipping');
        continue;
      }

      try {
        const thresholds = [];

        // Binary search for 50bps and 100bps thresholds
        for (const slippageBps of [50, 100]) {
          try {
            const slippage = slippageBps / 10000; // Convert bps to decimal

            // Start with reasonable bounds
            let minAmount = new Decimal('1000000'); // 1 USDC (6 decimals)
            let maxAmount = new Decimal('100000000000'); // 100k USDC
            let bestAmount = minAmount;

            for (let i = 0; i < 3; i++) { // Limited iterations for performance
              const testAmount = minAmount.plus(maxAmount).div(2);

              try {
                await this.http.get('/quote', {
                  params: {
                    fromChain: route.source.chainId,
                    toChain: route.destination.chainId,
                    fromToken: route.source.assetId,
                    toToken: route.destination.assetId,
                    fromAmount: testAmount.toString(),
                    slippage: slippage.toString()
                  }
                });

                // Quote succeeded, try larger amount
                bestAmount = testAmount;
                minAmount = testAmount;
              } catch {
                // Quote failed, try smaller amount
                maxAmount = testAmount;
              }

              // Convergence check
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
        console.error('Failed to get liquidity for route:', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return liquidity;
  }

  /**
   * Fetch supported tokens from Li.Fi API
   */
  private async getListedAssets(): Promise<ListedAssetsType> {
    try {
      const tokens = await this.http.get<{ tokens: Record<string, LiFiToken[]> }>('/tokens');

      if (!tokens?.tokens || typeof tokens.tokens !== 'object') {
        throw new Error('Invalid tokens response structure');
      }

      const assets: AssetType[] = [];

      // Flatten tokens from all chains
      Object.entries(tokens.tokens).forEach(([chainId, chainTokens]) => {
        if (!Array.isArray(chainTokens)) {
          console.warn(`Invalid token list for chain ${chainId}`);
          return;
        }

        chainTokens.forEach(token => {
          if (!token?.address || !token?.symbol || typeof token.decimals !== 'number') {
            console.warn('Invalid token structure, skipping token');
            return;
          }

          assets.push({
            chainId: chainId,
            assetId: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          });
        });
      });

      return {
        assets,
        measuredAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch Li.Fi tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  ping() {
    return Effect.tryPromise({
      try: async () => {
        return {
          status: "ok" as const,
          timestamp: new Date().toISOString(),
        };
      },
      catch: (error: unknown) =>
        new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`)
    });
  }
}
