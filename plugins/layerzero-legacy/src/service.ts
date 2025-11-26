import { createHttpClient, createRateLimiter } from '@data-provider/plugin-utils';
import type {
  AssetType,
  LiquidityDepthType,
  ListedAssetsType,
  ProviderSnapshotType,
  RateType,
  VolumeWindowType
} from '@data-provider/shared-contract';
import { Effect } from "every-plugin/effect";

// Stargate API Response Types
interface StargateChain {
  chainKey: string;
  chainType: string;
  chainId: number;
  shortName: string;
  name: string;
  nativeCurrency: {
    chainKey: string;
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  };
}

interface StargateToken {
  isBridgeable: boolean;
  chainKey: string;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  price: {
    usd: number;
  };
}

interface StargateQuote {
  route: string;
  error: string | null;
  srcAmount: string;
  dstAmount: string;
  srcAmountMax: string;
  dstAmountMin: string;
  srcToken: string;
  dstToken: string;
  srcAddress: string;
  dstAddress: string;
  srcChainKey: string;
  dstChainKey: string;
  fees: Array<{
    token: string;
    chainKey: string;
    amount: string;
    type: string;
  }>;
}

interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}



/**
 * LayerZero/Stargate Data Provider Service
 *
 * Collects cross-chain bridge metrics from LayerZero's Stargate protocol.
 * Uses Stargate Finance REST API for quotes, chains, and tokens.
 */
export class DataProviderService {
  private readonly LAYERZERO_BRIDGE_ID = "84"; // LayerZero bridge ID on DefiLlama
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;

  private chains: StargateChain[] | null = null;
  private tokens: StargateToken[] | null = null;
  private http: ReturnType<typeof createHttpClient>;
  private defillamaHttp: ReturnType<typeof createHttpClient>;

  constructor(
    private readonly baseUrl: string,
    private readonly defillamaBaseUrl: string,
    private readonly apiKey: string,
    private readonly timeout: number,
    maxRequestsPerSecond: number = 10
  ) {
    // Initialize HTTP clients with rate limiting
    this.http = createHttpClient({
      baseUrl: this.baseUrl,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: this.timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: this.defillamaBaseUrl,
      rateLimiter: createRateLimiter(100), // High rate limit for DefiLlama
      timeout: this.timeout,
      retries: 3
    });
  }

  /**
   * Get complete snapshot of provider data for given routes and notionals.
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

        console.log(`[LayerZero] Fetching snapshot for ${params.routes?.length || 0} routes`);

        // Parallel API calls with graceful degradation using Promise.allSettled
        // This allows working components to return data even if others fail (e.g., Module Federation bug)
        const results = await Promise.allSettled([
          this.getVolumes(params.includeWindows || ["24h"]),
          hasRoutes && hasNotionals ? this.getRates(params.routes!, params.notionals!) : Promise.resolve([]),
          hasRoutes ? this.getLiquidityDepth(params.routes!) : Promise.resolve([]),
          this.getListedAssets()
        ]);

        // Extract results, using empty arrays/defaults for failed promises
        const volumes = results[0].status === 'fulfilled' ? results[0].value : [];
        const rates = results[1].status === 'fulfilled' ? results[1].value : [];
        const liquidity = results[2].status === 'fulfilled' ? results[2].value : [];
        const listedAssets = results[3].status === 'fulfilled'
          ? results[3].value
          : { assets: [], measuredAt: new Date().toISOString() };

        // Log any failures for debugging
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const component = ['volumes', 'rates', 'liquidity', 'listedAssets'][index];
            console.warn(`[LayerZero] ⚠ ${component} failed (Module Federation bug):`, result.reason?.message || result.reason);
          }
        });

        return {
          volumes,
          rates,
          liquidity,
          listedAssets,
        } satisfies ProviderSnapshotType;
      },
      catch: (error: unknown) =>
        new Error(`Failed to fetch snapshot: ${error instanceof Error ? error.message : String(error)}`)
    });
  }

  /**
   * Fetch volume metrics from DefiLlama bridge aggregator.
   */
  private async getVolumes(windows: Array<"24h" | "7d" | "30d">): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumes();
      if (!bridgeData) {
        console.warn("[LayerZero] No volume data available from DefiLlama");
        return [];
      }

      const volumes: VolumeWindowType[] = [];
      const now = new Date().toISOString();

      for (const window of windows) {
        let volumeUsd: number;
        switch (window) {
          case "24h":
            volumeUsd = bridgeData.lastDailyVolume || 0;
            break;
          case "7d":
            volumeUsd = bridgeData.weeklyVolume || 0;
            break;
          case "30d":
            volumeUsd = bridgeData.monthlyVolume || 0;
            break;
        }
        volumes.push({ window, volumeUsd, measuredAt: now });
        console.log(`[LayerZero] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }
      return volumes;
    } catch (error) {
      console.error("[LayerZero] Failed to fetch volumes from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations using Stargate API.
   */
  private async getRates(
    routes: Array<{ source: AssetType; destination: AssetType }>,
    notionals: string[]
  ): Promise<RateType[]> {
    const rates: RateType[] = [];

    console.log(`[LayerZero] 🔍 getRates called with routes:`, JSON.stringify(routes, null, 2));

    // Ensure we have chains and tokens data
    await this.ensureMetadataLoaded();

    for (const route of routes) {
      for (const notional of notionals) {
        try {
          const quote = await this.fetchQuoteWithRetry(route.source, route.destination, notional);

          if (quote) {
            // Calculate effective rate using helper function
            const effectiveRate = this.calculateEffectiveRate(
              BigInt(quote.srcAmount),
              BigInt(quote.dstAmount),
              route.source.decimals,
              route.destination.decimals
            );

            // Calculate total fees in USD
            const totalFeesUsd = this.calculateFeesUsd(quote, route.source);

            rates.push({
              source: route.source,
              destination: route.destination,
              amountIn: quote.srcAmount,
              amountOut: quote.dstAmount,
              effectiveRate,
              totalFeesUsd,
              quotedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`[LayerZero] Failed to get quote for route:`, error);
          // Continue with other routes
        }
      }
    }

    return rates;
  }

  /**
   * Fetch liquidity depth at different slippage thresholds.
   *
   * Uses binary search to find the actual maximum amount that can be traded
   * while staying within the specified slippage threshold.
   *
   * Slippage is calculated as: |actualRate - baselineRate| / baselineRate
   *
   * - At 0.5% slippage (50bps): Find max amount where slippage ≤ 0.5%
   * - At 1.0% slippage (100bps): Find max amount where slippage ≤ 1.0%
   */
  private async getLiquidityDepth(
    routes: Array<{ source: AssetType; destination: AssetType }>
  ): Promise<LiquidityDepthType[]> {
    const liquidity: LiquidityDepthType[] = [];

    for (const route of routes) {
      try {
        console.log(`[LayerZero] Calculating liquidity depth for ${route.source.symbol}→${route.destination.symbol}...`);

        // Get baseline quote with small amount to establish the "zero slippage" rate
        const baselineAmount = this.getTestAmount(route.source);
        const baselineQuote = await this.fetchQuoteWithRetry(route.source, route.destination, baselineAmount);

        if (!baselineQuote || !baselineQuote.srcAmountMax) {
          console.warn(`[LayerZero] ⚠ No baseline quote for route ${route.source.symbol}→${route.destination.symbol}`);
          continue;
        }

        // Validate srcAmountMax
        let maxLiquidity: bigint;
        try {
          maxLiquidity = BigInt(baselineQuote.srcAmountMax);

          if (maxLiquidity <= 0) {
            console.warn(`[LayerZero] ⚠ Invalid srcAmountMax (≤0) for route, skipping liquidity calculation`);
            continue;
          }

          // Cap at reasonable value
          const maxReasonable = BigInt(10) ** BigInt(30);
          if (maxLiquidity > maxReasonable) {
            console.warn(`[LayerZero] ⚠ Suspiciously large srcAmountMax: ${baselineQuote.srcAmountMax}, capping`);
            maxLiquidity = maxReasonable;
          }
        } catch (error) {
          console.error(`[LayerZero] ❌ Invalid srcAmountMax format: ${baselineQuote.srcAmountMax}`, error);
          continue;
        }

        // Calculate baseline rate (normalized for decimals)
        const baselineRate = this.calculateEffectiveRate(
          BigInt(baselineQuote.srcAmount),
          BigInt(baselineQuote.dstAmount),
          route.source.decimals,
          route.destination.decimals
        );

        // Binary search for maximum amount at 50bps (0.5% slippage)
        const maxAt50bps = await this.findMaxAmountAtSlippage(
          route,
          baselineRate,
          BigInt(baselineAmount),
          maxLiquidity,
          50 // 0.5%
        );

        // Binary search for maximum amount at 100bps (1.0% slippage)
        const maxAt100bps = await this.findMaxAmountAtSlippage(
          route,
          baselineRate,
          BigInt(baselineAmount),
          maxLiquidity,
          100 // 1.0%
        );

        liquidity.push({
          route,
          thresholds: [
            {
              maxAmountIn: maxAt50bps.toString(),
              slippageBps: 50,
            },
            {
              maxAmountIn: maxAt100bps.toString(),
              slippageBps: 100,
            }
          ],
          measuredAt: new Date().toISOString(),
        });

        console.log(`[LayerZero] ✓ Liquidity depth measured for ${route.source.symbol}→${route.destination.symbol}`);
        console.log(`  - Max at 0.5% slippage: ${maxAt50bps.toString()}`);
        console.log(`  - Max at 1.0% slippage: ${maxAt100bps.toString()}`);

      } catch (error) {
        console.error(`[LayerZero] ❌ Failed to calculate liquidity for route:`, error);
        // Continue with other routes - graceful degradation
      }
    }

    return liquidity;
  }

  /**
   * Binary search to find maximum amount that stays within slippage threshold.
   *
   * @param route - Trading route
   * @param baselineRate - Reference rate from small amount quote
   * @param minAmount - Minimum amount to search from
   * @param maxAmount - Maximum amount to search to (from srcAmountMax)
   * @param slippageBps - Slippage threshold in basis points (50 = 0.5%, 100 = 1.0%)
   * @returns Maximum amount that stays within slippage threshold
   */
  private async findMaxAmountAtSlippage(
    route: { source: AssetType; destination: AssetType },
    baselineRate: number,
    minAmount: bigint,
    maxAmount: bigint,
    slippageBps: number
  ): Promise<bigint> {
    const maxIterations = 8; // Limit iterations to avoid too many API calls
    let left = minAmount;
    let right = maxAmount;
    let bestAmount = minAmount;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Binary search midpoint
      const mid = (left + right) / BigInt(2);

      // Avoid testing amounts too close to boundaries
      if (mid <= left || mid >= right) {
        break;
      }

      try {
        // Get quote for this amount
        const quote = await this.fetchQuoteWithRetry(
          route.source,
          route.destination,
          mid.toString(),
          2 // Fewer retries for binary search to save time
        );

        if (!quote) {
          // If quote fails, search in lower half
          right = mid;
          continue;
        }

        // Calculate rate for this amount
        const rate = this.calculateEffectiveRate(
          BigInt(quote.srcAmount),
          BigInt(quote.dstAmount),
          route.source.decimals,
          route.destination.decimals
        );

        // Calculate slippage: |rate - baselineRate| / baselineRate
        const slippage = Math.abs(rate - baselineRate) / baselineRate;
        const slippageInBps = slippage * 10000;

        console.log(`[LayerZero]   Binary search iteration ${iteration + 1}: amount=${mid.toString()}, slippage=${slippageInBps.toFixed(2)}bps`);

        if (slippageInBps <= slippageBps) {
          // Within threshold - try larger amount
          bestAmount = mid;
          left = mid;
        } else {
          // Exceeds threshold - try smaller amount
          right = mid;
        }

      } catch (error) {
        console.warn(`[LayerZero] ⚠ Quote failed during binary search at amount ${mid.toString()}`);
        // On error, search in lower half
        right = mid;
      }
    }

    return bestAmount;
  }

  /**
   * Calculate effective rate normalized for decimals.
   * Returns the rate as a decimal number (e.g., 0.998 for USDC->USDC with 0.2% fee)
   */
  private calculateEffectiveRate(
    srcAmount: bigint,
    dstAmount: bigint,
    srcDecimals: number,
    dstDecimals: number
  ): number {
    // Normalize: (dstAmount / 10^dstDecimals) / (srcAmount / 10^srcDecimals)
    // To preserve precision, use: (dstAmount * 10^srcDecimals) / (srcAmount * 10^dstDecimals)
    const scaleFactor = BigInt(1e18);
    const numerator = dstAmount * scaleFactor * BigInt(Math.pow(10, srcDecimals));
    const denominator = srcAmount * BigInt(Math.pow(10, dstDecimals));

    const effectiveRateScaled = numerator / denominator;
    return Number(effectiveRateScaled) / 1e18;
  }

  /**
   * Fetch list of assets supported by Stargate.
   */
  private async getListedAssets(): Promise<ListedAssetsType> {
    // TODO: Module Federation bug - fetch() causes "File URL host must be localhost" error
    // Returning empty list for now until framework is fixed
    console.log(`[LayerZero] Listed assets unavailable (Module Federation issue)`);
    return {
      assets: [],
      measuredAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch quote from Stargate API with retry and exponential backoff.
   */
  private async fetchQuoteWithRetry(
    source: AssetType,
    destination: AssetType,
    amount: string,
    maxRetries: number = 3
  ): Promise<StargateQuote | null> {
    let lastError: Error | null = null;
    const routeDescription = `${source.symbol}(${source.chainId}) → ${destination.symbol}(${destination.chainId})`;

    console.log(`[LayerZero] 🔍 fetchQuoteWithRetry called with:`, {
      source: { chainId: source.chainId, assetId: source.assetId, symbol: source.symbol },
      destination: { chainId: destination.chainId, assetId: destination.assetId, symbol: destination.symbol },
      amount
    });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const srcChainKey = this.getChainKeyById(source.chainId);
        const dstChainKey = this.getChainKeyById(destination.chainId);

        if (!srcChainKey || !dstChainKey) {
          const error = `Chain not found: ${source.chainId} or ${destination.chainId}`;
          console.error(`[LayerZero] ❌ ${error}`);
          throw new Error(error);
        }

        // Calculate dstAmountMin (95% of expected, accounting for fees)
        const srcAmountNum = BigInt(amount);
        const dstAmountMin = (srcAmountNum * BigInt(95) / BigInt(100)).toString();

        // Dummy addresses for quote (Stargate requires them)
        const dummyAddress = '0x0000000000000000000000000000000000000001';

        const params = {
          srcToken: source.assetId,
          dstToken: destination.assetId,
          srcChainKey: srcChainKey,
          dstChainKey: dstChainKey,
          srcAmount: amount,
          dstAmountMin: dstAmountMin,
          srcAddress: dummyAddress,
          dstAddress: dummyAddress,
        };

        if (attempt === 0) {
          console.log(`[LayerZero] Fetching quote for ${routeDescription}...`);
        }

        const data = await this.http.get<{ quotes: StargateQuote[] }>('/quotes', { params });

        // Return the first valid quote (prefer taxi over bus for speed)
        const validQuote = data.quotes.find(q => q.error === null);

        if (validQuote) {
          console.log(`[LayerZero] ✓ Quote received for ${routeDescription}`);
          return validQuote;
        } else {
          console.warn(`[LayerZero] ⚠ No valid quotes available for ${routeDescription}`);
          return null;
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(`[LayerZero] ⚠ Retry ${attempt + 1}/${maxRetries} for ${routeDescription} after ${backoffMs}ms (${lastError.message})`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    console.error(`[LayerZero] ❌ Failed to fetch quote for ${routeDescription} after ${maxRetries} retries:`, lastError?.message);
    return null;
  }

  /**
   * Ensure chains and tokens metadata is loaded
   */
  private async ensureMetadataLoaded(): Promise<void> {
    if (!this.chains) {
      this.chains = await this.fetchChainsWithRetry();
    }
    if (!this.tokens) {
      this.tokens = await this.fetchTokensWithRetry();
    }
  }

  /**
   * Fetch chains from Stargate API with retry
   */
  private async fetchChainsWithRetry(maxRetries: number = 3): Promise<StargateChain[]> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await this.http.get<{ chains: StargateChain[] }>('/chains');
        return data.chains;

      } catch (error) {
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } else {
          throw new Error(`Failed to fetch chains: ${error}`);
        }
      }
    }
    return [];
  }

  /**
   * Fetch tokens from Stargate API with retry
   */
  private async fetchTokensWithRetry(maxRetries: number = 3): Promise<StargateToken[]> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await this.http.get<{ tokens: StargateToken[] }>('/tokens');
        return data.tokens;

      } catch (error) {
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } else {
          throw new Error(`Failed to fetch tokens: ${error}`);
        }
      }
    }
    return [];
  }

  /**
   * Get chain key by numeric chain ID
   */
  private getChainKeyById(chainId: string): string | null {
    if (!this.chains) return null;
    const chain = this.chains.find(c => c.chainId.toString() === chainId);
    return chain?.chainKey || null;
  }

  /**
   * Get numeric chain ID by chain key
   */
  private getChainIdByKey(chainKey: string): string {
    if (!this.chains) return "0";
    const chain = this.chains.find(c => c.chainKey === chainKey);
    return chain?.chainId.toString() || "0";
  }

  /**
   * Calculate total fees in USD from quote
   */
  private calculateFeesUsd(quote: StargateQuote, sourceAsset: AssetType): number {
    try {
      // Get token price from metadata
      const token = this.tokens?.find(t =>
        t.address.toLowerCase() === sourceAsset.assetId.toLowerCase() &&
        t.chainKey === this.getChainKeyById(sourceAsset.chainId)
      );

      if (!token) {
        console.warn(`[LayerZero] ⚠ Token not found for fee calculation: ${sourceAsset.symbol}`);
        return 0;
      }

      // Check if price is valid
      if (!token.price || typeof token.price.usd !== 'number' || token.price.usd <= 0) {
        console.warn(`[LayerZero] ⚠ Invalid price for ${sourceAsset.symbol}: ${token.price?.usd}`);
        return 0;
      }

      // Validate fees array
      if (!quote.fees || !Array.isArray(quote.fees) || quote.fees.length === 0) {
        console.warn(`[LayerZero] ⚠ No fees in quote`);
        return 0;
      }

      // Sum all fees with validation
      let totalFees = BigInt(0);
      for (const fee of quote.fees) {
        try {
          const feeAmount = BigInt(fee.amount);
          if (feeAmount < 0) {
            console.warn(`[LayerZero] ⚠ Negative fee amount: ${fee.amount}`);
            continue;
          }
          totalFees += feeAmount;
        } catch (error) {
          console.warn(`[LayerZero] ⚠ Invalid fee amount: ${fee.amount}`, error);
        }
      }

      // Convert to USD
      const feesInToken = Number(totalFees) / Math.pow(10, sourceAsset.decimals);
      const feesUsd = feesInToken * token.price.usd;

      // Sanity check
      if (feesUsd < 0 || !isFinite(feesUsd)) {
        console.warn(`[LayerZero] ⚠ Invalid fee calculation result: ${feesUsd}`);
        return 0;
      }

      return feesUsd;
    } catch (error) {
      console.error(`[LayerZero] ❌ Error calculating fees:`, error);
      return 0;
    }
  }

  /**
   * Get test amount for liquidity checks (1 unit of token)
   */
  private getTestAmount(asset: AssetType): string {
    return Math.pow(10, asset.decimals).toString();
  }

  /**
   * Fetch volume data from DefiLlama Bridge API with caching and retry logic.
   */
  private async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && (Date.now() - this.volumeCache.fetchedAt) < this.VOLUME_CACHE_TTL) {
      console.log("[LayerZero] Using cached volume data from DefiLlama");
      return this.volumeCache.data;
    }

    try {
      const data = await this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.LAYERZERO_BRIDGE_ID}`);

      // Validate response has expected fields
      if (typeof data.lastDailyVolume !== 'number') {
        throw new Error("Invalid response structure from DefiLlama");
      }

      // Cache the result
      this.volumeCache = {
        data,
        fetchedAt: Date.now(),
      };

      console.log(`[LayerZero] Successfully fetched volumes from DefiLlama: 24h=$${data.lastDailyVolume.toLocaleString()}`);
      return data;
    } catch (error) {
      console.error(`[LayerZero] Failed to fetch volumes from DefiLlama:`, error instanceof Error ? error.message : String(error));

      // Cache the null result to avoid hammering the API
      this.volumeCache = {
        data: null,
        fetchedAt: Date.now(),
      };

      return null;
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
