import { calculateEffectiveRate, DataProviderService as BaseDataProviderService, getBlockchainFromChainId, getChainId } from '@data-provider/plugin-utils';
import { Effect } from "every-plugin/effect";
import { AcrossApiClient, type DefiLlamaBridgeResponse, type AcrossLimitsResponse, type AcrossTokenResponse, type AcrossSuggestedFeesResponse } from './client';

import type {
  AcrossAssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  SnapshotType,
  TimeWindow,
  VolumeWindowType
} from './contract';

  /**
   * Token price cache entry
   */
  interface TokenPrice {
    priceUsd: number;
    symbol: string;
    fetchedAt: number;
  }

/**
 * Data Provider Service for Across Protocol
 *
 * Across is a cross-chain bridge optimized for capital efficiency using an intent-based architecture.
 *
 * Key features:
 * - Fast cross-chain transfers (typically <1 min)
 * - Support for many chains (Ethereum, Optimism, Arbitrum, Polygon, Base, etc.)
 * - No API key required (optional integratorId for tracking)
 * - Dynamic fee pricing based on liquidity utilization
 * - Instant fills with relayer network
 */
export class AcrossService extends BaseDataProviderService<AcrossAssetType> {
  private readonly PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly ACROSS_BRIDGE_ID = "19"; // Across bridge ID on DefiLlama (numeric ID)

  // Cache for token prices and volumes to avoid excessive API calls
  private priceCache: Map<string, TokenPrice> = new Map();
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;

  // HTTP client
  private client: AcrossApiClient;

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number,
  ) {
    super(); // Call parent constructor

    // Initialize HTTP client
    this.client = new AcrossApiClient(baseUrl, timeout);
  }



  /**
   * Get complete snapshot of Across data for given routes and notionals.
   * Returns provider format - transformation to NEAR Intents happens in router layer.
   */
  async getSnapshot(params: {
    routes: RouteType<AcrossAssetType>[];
    notionals?: string[];
    includeWindows?: TimeWindow[];
  }): Promise<SnapshotType<AcrossAssetType>> {
    const hasRoutes = params.routes && params.routes.length > 0;
    const hasNotionals = params.notionals && params.notionals.length > 0;

    console.log(`[Across] Fetching snapshot for ${params.routes?.length || 0} routes`);

    const [volumes, rates, liquidity, providerAssets] = await Promise.all([
      this.getVolumes(params.includeWindows || ["24h"]),
      hasRoutes && hasNotionals ? this.getRates(params.routes, params.notionals!) : Promise.resolve([]),
      hasRoutes ? this.getLiquidityDepth(params.routes) : Promise.resolve([]),
      this.getListedAssets()
    ]);

    return {
      volumes,
      rates,
      liquidity,
      listedAssets: {
        assets: providerAssets,
        measuredAt: new Date().toISOString()
      },
    };
  }

  /**
   * Fetch volume metrics from DefiLlama Bridge API.
   * DefiLlama aggregates bridge volume data across all chains.
   *
   * @param windows - Time windows to fetch (24h, 7d, 30d)
   * @returns Array of volume windows with USD amounts
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumes();

      if (!bridgeData) {
        console.warn("[Across] No volume data available from DefiLlama");
        return [];
      }

      const volumes: VolumeWindowType[] = [];
      const now = new Date().toISOString();

      for (const window of windows) {
        let volumeUsd: number;

        switch (window) {
          case "24h":
            // Use lastDailyVolume which represents the last complete 24h period
            volumeUsd = bridgeData.lastDailyVolume || 0;
            break;
          case "7d":
            // Use weeklyVolume which represents the last 7 days
            volumeUsd = bridgeData.weeklyVolume || 0;
            break;
          case "30d":
            // Use monthlyVolume which represents the last 30 days
            volumeUsd = bridgeData.monthlyVolume || 0;
            break;
          default:
            // Skip unsupported windows (e.g., cumulative)
            console.log(`[Across] Skipping unsupported volume window: ${window}`);
            continue;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now,
        });

        console.log(`[Across] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[Across] Failed to fetch volumes from DefiLlama:", error);
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations.
   *
   * Uses Across suggested-fees API to get detailed fee breakdown.
   * All amounts are kept in smallest units (wei) as per contract specification.
   */
  async getRates(
    routes: RouteType<AcrossAssetType>[],
    notionals: string[]
  ): Promise<RateType<AcrossAssetType>[]> {
    const rates: RateType<AcrossAssetType>[] = [];

    for (const route of routes) {
      for (const notional of notionals) {
        try {
          const fees = await this.fetchSuggestedFees(
            route.source.address,
            route.destination.address,
            route.source.chainId,
            route.destination.chainId,
            notional
          );

          if (fees) {
            // All amounts in smallest units (wei)
            // notional is already in wei (source smallest units)
            const amountInWei = BigInt(notional);

            // relayFeeTotal is in destination token wei
            const relayFeeWei = BigInt(fees.relayFeeTotal);

            // For cross-chain transfers, we need to consider:
            // - Input is in source chain units
            // - Fee is in destination chain units
            // - Output is input minus fees (assuming 1:1 rate for same token)
            // The Across API returns fees in destination token smallest units

            // Calculate output amount in destination smallest units
            // Assumption: For same token (e.g. USDC->USDC), 1:1 base rate
            const amountOutWei = amountInWei - relayFeeWei;

            // Calculate effective rate with decimal precision
            const effectiveRate = calculateEffectiveRate(
              amountInWei.toString(),
              amountOutWei.toString(),
              route.source.decimals,
              route.destination.decimals
            );

            // Calculate total fees in USD
            // Get token price and convert fee to USD
            const tokenPrice = await this.getTokenPrice(route.destination.chainId, route.destination.address);
            const feeInTokens = Number(relayFeeWei) / Math.pow(10, route.destination.decimals);
            const totalFeesUsd = tokenPrice !== null ? feeInTokens * tokenPrice : null;

            rates.push({
              source: route.source,
              destination: route.destination,
              amountIn: amountInWei.toString(), // Keep as string in wei
              amountOut: amountOutWei.toString(), // Keep as string in wei
              effectiveRate,
              totalFeesUsd,
              quotedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`[Across] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
          // Continue to next route/notional instead of failing completely
        }
      }
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using Across limits API.
   *
   * Across provides maxDepositInstant which indicates available liquidity for instant fills.
   */
  async getLiquidityDepth(
    routes: RouteType<AcrossAssetType>[]
  ): Promise<LiquidityDepthType<AcrossAssetType>[]> {
    const liquidity: LiquidityDepthType<AcrossAssetType>[] = [];

    for (const route of routes) {
      try {
        const limits = await this.fetchLimits(
          route.source.address,
          route.destination.address,
          route.source.chainId,
          route.destination.chainId
        );

        if (limits) {
          // Keep amounts in source smallest units (wei) as per contract specification
          // maxAmountIn must be in source units, not converted to decimal
          liquidity.push({
            route,
            thresholds: [
              {
                // Recommended instant amount: low slippage (50bps)
                // Contract requires string in source smallest units
                maxAmountIn: limits.recommendedDepositInstant,
                slippageBps: 50,
              },
              {
                // Max instant fill: higher slippage (100bps)
                // Contract requires string in source smallest units
                maxAmountIn: limits.maxDepositInstant,
                slippageBps: 100,
              }
            ],
            measuredAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`[Across] Failed to fetch liquidity for ${route.source.symbol}:`, error);
      }
    }

    return liquidity;
  }

  /**
   * Fetch list of assets supported by Across.
   * Uses /available-routes endpoint and extracts unique tokens.
   */
  async getListedAssets(): Promise<AcrossAssetType[]> {
    try {
      const tokens = await this.fetchTokens();

      // Deduplicate assets based on (chainId, address) pairs
      // The API may return duplicate tokens, so we need to ensure uniqueness
      const uniqueAssets = Array.from(
        new Map(
          tokens.map(asset => [`${asset.chainId}:${asset.address}`, asset])
        ).values()
      );

      console.log(`[Across] Deduplicated ${tokens.length} assets to ${uniqueAssets.length} unique assets`);

      return uniqueAssets;
    } catch (error) {
      console.error("[Across] Failed to fetch listed assets:", error);
      return [];
    }
  }


  /**
   * Fetch suggested fees from Across API.
   */
  private async fetchSuggestedFees(
    inputToken: string,
    outputToken: string,
    originChainId: number,
    destinationChainId: number,
    amount: string
  ): Promise<AcrossSuggestedFeesResponse | null> {
    try {
      const data = await this.client.fetchSuggestedFees({
        inputToken,
        outputToken,
        originChainId,
        destinationChainId,
        amount
      });

      // Validate response structure
      if (!data.relayFeeTotal || typeof data.relayFeeTotal !== 'string') {
        throw new Error("Invalid response structure: missing relayFeeTotal");
      }

      console.log(`[Across] Successfully fetched suggested fees: ${data.relayFeeTotal}`);
      return data;
    } catch (error) {
      console.error(`[Across] Failed to fetch suggested fees:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Fetch deposit limits from Across API.
   */
  private async fetchLimits(
    inputToken: string,
    outputToken: string,
    originChainId: number,
    destinationChainId: number
  ): Promise<AcrossLimitsResponse | null> {
    try {
      const data = await this.client.fetchLimits({
        inputToken,
        outputToken,
        originChainId,
        destinationChainId
      });

      // Validate response structure
      if (!data.maxDepositInstant || !data.recommendedDepositInstant) {
        throw new Error("Invalid response structure: missing deposit limits");
      }

      console.log(`[Across] Successfully fetched limits: max=${data.maxDepositInstant}`);
      return data;
    } catch (error) {
      console.error(`[Across] Failed to fetch limits:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Fetch supported tokens from Across API.
   * Uses /swap/tokens endpoint.
   */
  private async fetchTokens(): Promise<AcrossAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

      // Convert to AcrossAssetType format and cache prices
      const assets: AcrossAssetType[] = tokens.map(token => {
        // Cache token price if available
        if (token.priceUsd) {
          const cacheKey = `${token.chainId}:${token.address.toLowerCase()}`;
          this.priceCache.set(cacheKey, {
            priceUsd: parseFloat(token.priceUsd),
            symbol: token.symbol,
            fetchedAt: Date.now(),
          });
        }

        return {
          chainId: token.chainId,
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          priceUsd: token.priceUsd,
        };
      });

      console.log(`[Across] Successfully fetched ${assets.length} tokens`);
      return assets;
    } catch (error) {
      console.error(`[Across] Failed to fetch tokens:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Fetch volume data from DefiLlama Bridge API.
   * DefiLlama provides aggregated bridge statistics including 24h, 7d, and 30d volumes.
   *
   * @returns Bridge data from DefiLlama or null if unavailable
   */
  private async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && (Date.now() - this.volumeCache.fetchedAt) < this.VOLUME_CACHE_TTL) {
      console.log("[Across] Using cached volume data from DefiLlama");
      return this.volumeCache.data;
    }

    try {
      const data = await this.client.fetchDefiLlamaVolumes(this.ACROSS_BRIDGE_ID);

      // Validate response has expected fields
      if (typeof data.lastDailyVolume !== 'number') {
        throw new Error("Invalid response structure from DefiLlama");
      }

      // Cache the result
      this.volumeCache = {
        data,
        fetchedAt: Date.now(),
      };

      console.log(`[Across] Successfully fetched volumes from DefiLlama: 24h=$${data.lastDailyVolume.toLocaleString()}`);
      return data;
    } catch (error) {
      console.error(`[Across] Failed to fetch volumes from DefiLlama:`, error instanceof Error ? error.message : String(error));

      // Cache the null result to avoid hammering the API
      this.volumeCache = {
        data: null,
        fetchedAt: Date.now(),
      };

      return null;
    }
  }

  /**
   * Get token price in USD from cached data.
   *
   * @param chainId - The chain ID where the token exists
   * @param tokenAddress - The token contract address
   * @returns Price in USD or null if unavailable
   */
  private async getTokenPrice(chainId: number, tokenAddress: string): Promise<number | null> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
    const cached = this.priceCache.get(cacheKey);

    if (cached && (Date.now() - cached.fetchedAt) < this.PRICE_CACHE_TTL) {
      return cached.priceUsd;
    }

    // Price not available or expired
    return null;
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
