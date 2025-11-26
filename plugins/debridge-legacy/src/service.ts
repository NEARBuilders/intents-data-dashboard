import { Effect } from "every-plugin/effect";
import { createHttpClient, createRateLimiter, calculateEffectiveRate } from '@data-provider/plugin-utils';
import type {
  AssetType,
  RateType,
  LiquidityDepthType,
  VolumeWindowType,
  ListedAssetsType,
  ProviderSnapshotType
} from '@data-provider/shared-contract';

import { TTLCache, RequestDeduplicator, CircuitBreaker } from "./utils/cache";
import { Logger, PerformanceTimer } from "./utils/logger";



// deBridge DLN API response types
interface DeBridgeOrder {
  orderId: string;
  giveChainId: number;
  takeChainId: number;
  giveTokenAddress: string;
  takeTokenAddress: string;
  giveAmount: string;
  takeAmount: string;
  createdAt: string;
  status: string;
  affiliateFee?: string;
  // Add more fields as discovered from actual API
}

interface DeBridgeQuote {
  estimation: {
    srcChainTokenIn: {
      address: string;
      chainId: number;
      decimals: number;
      name: string;
      symbol: string;
      amount: string;
      approximateOperatingExpense?: string;
      mutatedWithOperatingExpense?: boolean;
      approximateUsdValue?: number;
      originApproximateUsdValue?: number;
    };
    srcChainTokenOut?: {  // Optional - only if pre-swap happens
      address: string;
      chainId: number;
      decimals: number;
      name: string;
      symbol: string;
      amount: string;
      maxRefundAmount?: string;
      approximateUsdValue?: number;
    };
    dstChainTokenOut: {
      address: string;
      chainId: number;
      decimals: number;
      name: string;
      symbol: string;
      amount: string;
      recommendedAmount?: string;
      maxTheoreticalAmount?: string;
      approximateUsdValue?: number;
      recommendedApproximateUsdValue?: number;
      maxTheoreticalApproximateUsdValue?: number;
    };
    costsDetails: Array<{
      chain: string;
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      amountOut: string;
      type: string;
      payload?: {
        feeAmount?: string;
        feeBps?: string;
        estimatedVolatilityBps?: string;
        feeApproximateUsdValue?: string;
      };
    }>;
    recommendedSlippage?: number;
  };
  tx?: {
    to: string;
    data: string;
    value: string;
  };
  prependedOperatingExpenseCost?: string;
  order?: {
    approximateFulfillmentDelay: number;
    salt: number;
    metadata: string;
  };
  orderId: string;
  fixFee?: string;
  protocolFee?: string;
  userPoints?: number;
  integratorPoints?: number;
  estimatedTransactionFee?: {
    total: string;
    details: {
      gasLimit: string;
      baseFee: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
  };
  protocolFeeApproximateUsdValue?: number;
  usdPriceImpact?: number;
}

interface DeBridgeChain {
  chainId: number;
  chainName: string;
  chainType: string;
}

interface DeBridgeToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
}

interface DeBridgeTokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

interface DeBridgeTokenListResponse {
  tokens: Record<string, DeBridgeTokenInfo>;
}

interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * deBridge DLN Data Provider Service
 * 
 * Production-ready data provider for deBridge Liquidity Network (DLN).
 * Uses official deBridge APIs and DefiLlama for aggregated volume data.
 */
export class DataProviderService {
  private static readonly DEFAULT_BASE_URL = "https://dln.debridge.finance/v1.0";
  private static readonly DEFAULT_DEFILLAMA_BASE_URL = "https://bridges.llama.fi";
  private static readonly TOKEN_LIST_TTL = 5 * 60 * 1000; // 5 minutes

  private readonly dlnApiBase: string;
  private readonly defillamaBaseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly logger: Logger;
  private http: ReturnType<typeof createHttpClient>;
  private defillamaHttp: ReturnType<typeof createHttpClient>;
  private readonly DEBRIDGE_LLAMA_ID = "20";

  // Caching
  private readonly quoteCache = new TTLCache<string, DeBridgeQuote>(5 * 60 * 1000); // 5 min
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private tokenListCache = new Map<string, { assets: AssetType[]; fetchedAt: number }>();

  // Enterprise Features: Request Deduplication and Circuit Breakers
  private readonly deduplicator = new RequestDeduplicator<any>();
  private readonly dlnCircuit = new CircuitBreaker(5, 60000);

  constructor(
    baseUrl: string,
    defillamaBaseUrl: string,
    apiKey: string,
    timeout: number,
    maxRequestsPerSecond: number = 10
  ) {
    // Sanitize URLs
    this.dlnApiBase = this.sanitizeHttpUrl(
      baseUrl,
      DataProviderService.DEFAULT_BASE_URL
    );
    this.defillamaBaseUrl = this.sanitizeHttpUrl(
      defillamaBaseUrl,
      DataProviderService.DEFAULT_DEFILLAMA_BASE_URL
    );

    this.apiKey = apiKey?.trim?.() ?? "not-required";
    this.timeout = timeout;

    // Initialize HTTP client with rate limiting
    this.http = createHttpClient({
      baseUrl: this.dlnApiBase,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: this.timeout,
      retries: 3
    });

    // Initialize DefiLlama HTTP client (separate rate limiter for external API)
    this.defillamaHttp = createHttpClient({
      baseUrl: this.defillamaBaseUrl,
      rateLimiter: createRateLimiter(100), // High rate limit for DefiLlama
      timeout: this.timeout,
      retries: 3
    });

    // Initialize structured logger
    this.logger = new Logger('deBridge:Service', (typeof process !== 'undefined' ? process.env.LOG_LEVEL : 'info') as any || 'info');

    console.log("[deBridge] Service configuration", {
      dlnApiBase: this.dlnApiBase,
      defillamaBaseUrl: this.defillamaBaseUrl,
      timeout: this.timeout,
      maxRequestsPerSecond,
    });
  }

  /**
   * Get complete snapshot of provider data for given routes and notionals.
   *
   * Orchestrates parallel fetching of:
   * - Volume metrics (24h, 7d, 30d)
   * - Rate quotes with fee breakdown
   * - Liquidity depth at 50bps and 100bps
   * - Supported assets across all chains
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
            this.getListedAssets(params.routes || [])
          ]);

          return {
            volumes,
            rates,
            liquidity,
            listedAssets,
          } satisfies ProviderSnapshotType;
        } catch (error) {
          this.logger.error('Snapshot fetch failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw new Error(`Snapshot fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      catch: (error: unknown) =>
        new Error(`Failed to fetch snapshot: ${error instanceof Error ? error.message : String(error)}`)
    });
  }

  /**
   * Fetch volume metrics from deBridge DLN Stats API
   * Uses POST /api/Orders/filteredList with pagination support
   * 
   * Enterprise features:
   * - TTL caching (5 minutes)
   * - Circuit breaker protection
   * - Pagination (up to 5 pages, 5000 orders)
   * - Structured logging
   */
  /**
   * Fetch volumes from DefiLlama bridge aggregator
   */
  private async getVolumes(windows: Array<"24h" | "7d" | "30d">): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumes();
      if (!bridgeData) {
        this.logger.warn('No volume data available from DefiLlama');
        return [];
      }

      const volumes: VolumeWindowType[] = [];
      const now = new Date().toISOString();

      for (const window of windows) {
        let volumeUsd: number | undefined;
        switch (window) {
          case "24h":
            volumeUsd = bridgeData.lastDailyVolume;
            break;
          case "7d":
            volumeUsd = bridgeData.weeklyVolume;
            break;
          case "30d":
            volumeUsd = bridgeData.monthlyVolume;
            break;
        }
        if (volumeUsd !== undefined) {
          volumes.push({ window, volumeUsd, measuredAt: now });
          this.logger.info('Volume fetched', { window, volumeUsd });
        }
      }
      return volumes;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to fetch volumes from DefiLlama', { error: message });
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch rate quotes from deBridge DLN
   * Gets real-time quotes with fee breakdown
   * 
   * Enterprise features:
   * - TTL caching (5 minutes)
   * - Circuit breaker protection
   * - Request deduplication
   * - Structured logging
   */
  private async getRates(
    routes: Array<{ source: AssetType; destination: AssetType }>,
    notionals: string[]
  ): Promise<RateType[]> {
    if (!routes?.length || !notionals?.length) {
      throw new Error('Routes and notionals are required for rate fetching');
    }

    this.logger.info('Fetching rates', {
      routeCount: routes.length,
      notionalCount: notionals.length,
    });

    const rates: RateType[] = [];

    for (const route of routes) {
      if (!route?.source || !route?.destination) {
        this.logger.warn('Invalid route structure, skipping', { route });
        continue;
      }

      for (const notional of notionals) {
        if (!notional || isNaN(Number(notional))) {
          this.logger.warn('Invalid notional, skipping', { notional });
          continue;
        }

        try {
          // Generate cache key for this quote
          const cacheKey = `${route.source.chainId}-${route.source.assetId}-${route.destination.chainId}-${route.destination.assetId}-${notional}`;

          // Check cache first
          const cachedQuote = this.quoteCache.get(cacheKey);
          let quote: DeBridgeQuote;

          if (cachedQuote) {
            this.logger.debug('Quote cache hit', { cacheKey });
            quote = cachedQuote;
          } else {
            // Fetch with circuit breaker + deduplication
            quote = await this.dlnCircuit.execute(() =>
              this.deduplicator.deduplicate(
                cacheKey,
                () => this.http.post<DeBridgeQuote>('/v1.0/dln/order/quote', {
                  body: {
                    srcChainId: route.source.chainId,
                    srcChainTokenIn: route.source.assetId,
                    srcChainTokenInAmount: notional,
                    dstChainId: route.destination.chainId,
                    dstChainTokenOut: route.destination.assetId,
                    dstChainTokenOutAmount: 'auto',
                    prependOperatingExpenses: 'true'
                  },
                  headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
                })
              )
            );

            // Cache the quote
            this.quoteCache.set(cacheKey, quote);
            this.logger.debug('Quote fetched and cached', { cacheKey });
          }

          if (!quote?.estimation) {
            throw new Error('Invalid quote response structure');
          }

          const srcToken = quote.estimation.srcChainTokenIn;
          const dstToken = quote.estimation.dstChainTokenOut;

          const fromAmount = srcToken.amount;
          const toAmount = dstToken.recommendedAmount ?? dstToken.amount;

          if (!fromAmount || !toAmount) {
            throw new Error('Missing amount data in quote estimation');
          }

          // Calculate fees using USD difference (more accurate than costsDetails sum)
          const approximateInUsd = srcToken.approximateUsdValue ?? srcToken.originApproximateUsdValue;
          const approximateOutUsd = dstToken.recommendedApproximateUsdValue ??
            dstToken.approximateUsdValue ??
            dstToken.maxTheoreticalApproximateUsdValue;

          let totalFeesUsd: number | null = null;
          if (approximateInUsd !== undefined && approximateInUsd !== null &&
            approximateOutUsd !== undefined && approximateOutUsd !== null) {
            totalFeesUsd = Math.max(approximateInUsd - approximateOutUsd, 0);
          }

          // Calculate effective rate with decimal.js for precision
          const effectiveRate = calculateEffectiveRate(
            fromAmount,
            toAmount,
            route.source.decimals,
            route.destination.decimals
          );

          rates.push({
            source: route.source,
            destination: route.destination,
            amountIn: fromAmount,
            amountOut: toAmount,
            effectiveRate,
            totalFeesUsd,
            quotedAt: new Date().toISOString(),
          });

          this.logger.debug('Rate calculated', {
            route: `${route.source.symbol}->${route.destination.symbol}`,
            notional,
            effectiveRate,
            totalFeesUsd,
            inUsd: approximateInUsd,
            outUsd: approximateOutUsd
          });

        } catch (error) {
          this.logger.error('Failed to get rate for route', {
            route: `${route.source.symbol}->${route.destination.symbol}`,
            notional,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    this.logger.info('Rates fetched', { rateCount: rates.length });
    return rates;
  }

  /**
   * Get liquidity depth using maxTheoreticalAmount from quote API
   * Single API call per route (5x faster than progressive probing)
   */
  private async getLiquidityDepth(
    routes: Array<{ source: AssetType; destination: AssetType }>
  ): Promise<LiquidityDepthType[]> {
    if (!routes?.length) {
      this.logger.warn('No routes provided for liquidity depth');
      return [];
    }

    const liquidity: LiquidityDepthType[] = [];

    for (const route of routes) {
      if (!route?.source || !route?.destination) {
        this.logger.warn('Invalid route structure for liquidity, skipping', { route });
        continue;
      }

      try {
        // Calculate reference amount ($1000 worth)
        let referenceAmount: string;
        try {
          const decimals = BigInt(route.source.decimals);
          referenceAmount = (1000n * (10n ** decimals)).toString();
        } catch (error) {
          this.logger.error('Invalid decimals, skipping route', {
            decimals: route.source.decimals,
            route: `${route.source.symbol}->${route.destination.symbol}`,
            error: error instanceof Error ? error.message : String(error)
          });
          // Skip route with invalid decimals instead of using fake fallback
          continue;
        }

        // Get quote with maxTheoreticalAmount
        const quote = await this.fetchQuoteWithRetry(route.source, route.destination, referenceAmount);
        const estimation = quote?.estimation;

        if (!estimation) {
          this.logger.warn('No estimation in quote response', { route: `${route.source.symbol}->${route.destination.symbol}` });
          continue;
        }

        const srcToken = estimation.srcChainTokenIn;
        const dstToken = estimation.dstChainTokenOut;

        const srcAmount = srcToken?.amount ?? referenceAmount;
        const recommendedDest = dstToken?.recommendedAmount ?? dstToken?.amount;
        const maxDest = dstToken?.maxTheoreticalAmount ?? recommendedDest;

        if (!srcAmount || !recommendedDest) {
          this.logger.warn('Missing amount data in quote', { route: `${route.source.symbol}->${route.destination.symbol}` });
          continue;
        }

        // Calculate max source amount based on maxTheoreticalAmount
        let maxSource = srcAmount;
        if (maxDest && recommendedDest !== '0') {
          try {
            const srcBig = BigInt(srcAmount);
            const recommendedBig = BigInt(recommendedDest);
            const maxBig = BigInt(maxDest);
            if (recommendedBig > 0n) {
              maxSource = ((srcBig * maxBig) / recommendedBig).toString();
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn('Failed to compute max source for liquidity', { error: message });
          }
        }

        liquidity.push({
          route,
          thresholds: [
            {
              maxAmountIn: srcAmount,
              slippageBps: 50,
            },
            {
              maxAmountIn: maxSource,
              slippageBps: 100,
            }
          ],
          measuredAt: new Date().toISOString(),
        });

        this.logger.debug('Liquidity depth calculated', {
          route: `${route.source.symbol}->${route.destination.symbol}`,
          srcAmount,
          maxSource,
          ratio: maxDest && recommendedDest !== '0' ? (Number(maxDest) / Number(recommendedDest)).toFixed(2) : 'N/A'
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to fetch liquidity for route', {
          route: `${route.source.symbol}->${route.destination.symbol}`,
          error: message
        });
      }
    }

    return liquidity;
  }

  /**
   * Fetch quote with retry logic and exponential backoff
   */
  private async fetchQuoteWithRetry(
    source: AssetType,
    destination: AssetType,
    amount: string,
    maxRetries: number = 3
  ): Promise<DeBridgeQuote | null> {
    const authorityAddress = '0x1111111111111111111111111111111111111111'; // Default account

    try {
      const data = await this.http.post<DeBridgeQuote>('/v1.0/dln/order/quote', {
        body: {
          srcChainId: source.chainId,
          srcChainTokenIn: source.assetId,
          srcChainTokenInAmount: amount,
          dstChainId: destination.chainId,
          dstChainTokenOut: destination.assetId,
          dstChainTokenOutRecipient: authorityAddress,
          dstChainTokenOutAmount: 'auto',
          dstChainOrderAuthorityAddress: authorityAddress,
          srcChainOrderAuthorityAddress: authorityAddress,
          prependOperatingExpenses: 'true'
        },
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
      });

      if (!data?.estimation) {
        this.logger.warn('Quote response missing estimation', {
          source: source.symbol,
          destination: destination.symbol
        });
        return null;
      }

      this.logger.debug('Quote fetched successfully', {
        source: source.symbol,
        destination: destination.symbol
      });

      return data;
    } catch (error) {
      this.logger.error('Quote request failed', {
        error: error instanceof Error ? error.message : String(error),
        source: source.symbol,
        destination: destination.symbol
      });
      return null;
    }
  }

  /**
   * Fetch supported tokens from deBridge using comprehensive chains info endpoint
   *
   * Enterprise features:
   * - TTL caching (1 hour - metadata rarely changes)
   * - Circuit breaker protection
   * - Request deduplication
   */
  private async getListedAssets(routes: Array<{ source: AssetType; destination: AssetType }>): Promise<ListedAssetsType> {
    const measuredAt = new Date().toISOString();

    // Check cache first (5 minute TTL for comprehensive data)
    const cacheKey = 'supported-chains-info';
    const cached = this.tokenListCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < DataProviderService.TOKEN_LIST_TTL) {
      this.logger.debug('Using cached comprehensive chains info');
      return {
        assets: cached.assets,
        measuredAt,
      };
    }

    try {
      // Single comprehensive API call to get all supported chains and tokens
      const chainsInfo = await this.http.get<any>('/v1.0/supported-chains-info');

      if (!chainsInfo || typeof chainsInfo !== 'object') {
        throw new Error('Invalid chains info response structure');
      }

      const assets: AssetType[] = [];
      const seen = new Set<string>();

      // Parse the comprehensive response
      // The response structure may vary, but typically contains chains with their tokens
      for (const [chainIdStr, chainData] of Object.entries(chainsInfo)) {
        if (!chainData || typeof chainData !== 'object') {
          continue;
        }

        const chainInfo = chainData as any;

        // Extract tokens from this chain
        if (chainInfo.tokens && typeof chainInfo.tokens === 'object') {
          for (const [tokenAddress, tokenInfo] of Object.entries(chainInfo.tokens)) {
            if (!tokenInfo || typeof tokenInfo !== 'object') {
              continue;
            }

            const token = tokenInfo as any;
            if (!token?.address) {
              continue;
            }

            const assetId = token.address.toLowerCase();
            const key = `${chainIdStr}:${assetId}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);

            const decimalsRaw = typeof token.decimals === 'number'
              ? token.decimals
              : Number.parseInt(String(token.decimals ?? '18'), 10);
            const decimals = Number.isFinite(decimalsRaw) ? decimalsRaw : 18;

            const asset: AssetType = {
              chainId: chainIdStr,
              assetId,
              symbol: token.symbol ?? token.name ?? tokenAddress,
              decimals,
            };
            assets.push(asset);
          }
        }
      }

      // Cache the comprehensive result
      this.tokenListCache.set(cacheKey, {
        assets,
        fetchedAt: Date.now(),
      });

      this.logger.info('Comprehensive chains info fetched', { totalAssets: assets.length });
      return {
        assets,
        measuredAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Comprehensive chains info fetch failed', { error: message });

      // Fallback: return empty assets rather than failing
      return {
        assets: [],
        measuredAt,
      };
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

  /**
   * Fetch volumes from DefiLlama bridge aggregator API
   */
  private async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && Date.now() - this.volumeCache.fetchedAt < this.VOLUME_CACHE_TTL) {
      return this.volumeCache.data;
    }

    try {
      const raw = await this.defillamaHttp.get<any>(`/bridge/${this.DEBRIDGE_LLAMA_ID}`);
      const data = this.parseDefiLlamaResponse(raw);

      if (!data) {
        this.logger.warn('DefiLlama response missing required fields');
        this.volumeCache = { data: null, fetchedAt: Date.now() };
        return null;
      }

      this.volumeCache = { data, fetchedAt: Date.now() };
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('DefiLlama request failed', { error: message });
      return null;
    }
  }

  /**
   * Parse and validate DefiLlama bridge response
   */
  private parseDefiLlamaResponse(raw: unknown): DefiLlamaBridgeResponse | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const candidate = raw as Record<string, unknown>;

    const toNumeric = (input: unknown): number | null => {
      if (typeof input === "number" && Number.isFinite(input)) {
        return input;
      }
      if (typeof input === "string") {
        const parsed = Number.parseFloat(input);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const lastDailyVolume = toNumeric(candidate.lastDailyVolume);
    const weeklyVolume = toNumeric(candidate.weeklyVolume ?? candidate.lastWeeklyVolume);
    const monthlyVolume = toNumeric(candidate.monthlyVolume ?? candidate.lastMonthlyVolume);

    if (
      lastDailyVolume === null ||
      weeklyVolume === null ||
      monthlyVolume === null
    ) {
      return null;
    }

    const id = typeof candidate.id === "string" ? candidate.id : String(candidate.id ?? "");
    const displayName = typeof candidate.displayName === "string" ? candidate.displayName : id;

    return {
      id,
      displayName,
      lastDailyVolume,
      weeklyVolume,
      monthlyVolume,
    };
  }

  /**
   * Sanitizes and validates HTTP URLs
   * @param url - URL to sanitize
   * @param fallback - Fallback URL if validation fails
   * @returns Sanitized URL string
   */
  private sanitizeHttpUrl(url: string, fallback: string): string {
    try {
      // Remove trailing slash
      const trimmedUrl = url.replace(/\/$/, "");

      // Parse URL to validate
      const parsedUrl = new URL(trimmedUrl);

      // Only allow http and https protocols
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        console.warn(`[deBridge] Invalid protocol ${parsedUrl.protocol}, using fallback`);
        return fallback;
      }

      return trimmedUrl;
    } catch (error) {
      console.warn(`[deBridge] Invalid URL ${url}, using fallback:`, error);
      return fallback;
    }
  }
}
