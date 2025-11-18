import { Effect } from "every-plugin/effect";
import { calculateEffectiveRate, DataProviderService as BaseDataProviderService } from '@data-provider/plugin-utils';
import { CBridgeApiClient, DefiLlamaApiClient, type DefiLlamaBridgeResponse } from './client';
import type {
  CBridgeAssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  SnapshotType,
  TimeWindow,
  VolumeWindowType
} from './contract';

/**
 * cBridge Data Provider Service - Collects cross-chain bridge metrics from cBridge.
 *
 * API Documentation: https://cbridge-docs.celer.network/developer/api-reference
 * Endpoints:
 * - v2/getTransferConfigsForAll: Get chains and tokens
 * - v2/estimateAmt: Get rate quotes
 */
export class CBridgeService extends BaseDataProviderService<CBridgeAssetType> {
  private readonly CBRIDGE_BRIDGE_ID = "10"; // cBridge bridge ID on DefiLlama
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;

  constructor(
    private readonly cBridgeClient: CBridgeApiClient,
    private readonly defillamaClient: DefiLlamaApiClient
  ) {
    super();
  }

  /**
   * Get complete snapshot of provider data for given routes and notionals.
   * Returns provider format - transformation to NEAR Intents happens in router layer.
   */
  async getSnapshot(params: {
    routes: RouteType<CBridgeAssetType>[];
    notionals?: string[];
    includeWindows?: TimeWindow[];
  }): Promise<SnapshotType<CBridgeAssetType>> {
    const hasRoutes = params.routes && params.routes.length > 0;
    const hasNotionals = params.notionals && params.notionals.length > 0;

    console.log(`[cBridge] Fetching snapshot for ${params.routes?.length || 0} provider routes`);

    const [volumes, listedAssets] = await Promise.all([
      this.getVolumes(params.includeWindows || ["24h"]),
      this.getListedAssets()
    ]);

    const rates = hasRoutes && hasNotionals
      ? await this.getRates(params.routes, params.notionals!)
      : [];

    const liquidity = hasRoutes
      ? await this.getLiquidityDepth(params.routes)
      : [];

    return {
      volumes,
      listedAssets: {
        assets: listedAssets,
        measuredAt: new Date().toISOString()
      },
      ...(rates.length > 0 && { rates }),
      ...(liquidity.length > 0 && { liquidity })
    };
  }

  /**
   * Fetch volume metrics from DefiLlama bridge aggregator.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumes();
      if (!bridgeData) {
        console.warn("[cBridge] No volume data available from DefiLlama");
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
        console.log(`[cBridge] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }
      return volumes;
    } catch (error) {
      console.error("[cBridge] Failed to fetch volumes from DefiLlama:", error);
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch transfer latency for a route
   */
  private async getTransferLatency(srcChainId: string, dstChainId: string): Promise<number | null> {
    try {
      const data = await this.cBridgeClient.fetchTransferLatency({
        src_chain_id: srcChainId,
        dst_chain_id: dstChainId
      });

      if (data.err) {
        return null;
      }

      return data.median_transfer_latency_in_second;
    } catch (error) {
      console.warn(`Error fetching transfer latency: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations.
   * Uses cBridge's estimateAmt endpoint to get actual quotes.
   */
  async getRates(
    routes: RouteType<CBridgeAssetType>[],
    notionals: string[]
  ): Promise<RateType<CBridgeAssetType>[]> {
    const rates: RateType<CBridgeAssetType>[] = [];

    // Cache latencies per route to avoid duplicate requests
    const latencyCache = new Map<string, number | null>();

    for (const route of routes) {
      // Get latency for this route (cached)
      const latencyKey = `${route.source.chainId}-${route.destination.chainId}`;
      if (!latencyCache.has(latencyKey)) {
        const latency = await this.getTransferLatency(route.source.chainId.toString(), route.destination.chainId.toString());
        latencyCache.set(latencyKey, latency);
      }

      for (const notional of notionals) {
        try {
          const tokenSymbol = route.source.symbol;
          const amt = notional;

          const data = await this.cBridgeClient.fetchEstimate({
            src_chain_id: route.source.chainId.toString(),
            dst_chain_id: route.destination.chainId.toString(),
            token_symbol: tokenSymbol,
            amt: amt,
            usr_addr: '0x0000000000000000000000000000000000000000',
            slippage_tolerance: 5000
          });

          if (data.err) {
            console.warn(`Failed to get rate for ${tokenSymbol}: ${data.err.msg}`);
            continue;
          }

          // Calculate effective rate (normalized for decimals)
          const amountIn = BigInt(amt);
          const amountOut = BigInt(data.estimated_receive_amt);
          const effectiveRate = calculateEffectiveRate(
            amountIn.toString(),
            amountOut.toString(),
            route.source.decimals,
            route.destination.decimals
          );

          // Calculate total fees in USD (approximate)
          const baseFee = BigInt(data.base_fee);
          const percFee = BigInt(data.perc_fee);
          const totalFee = baseFee + percFee;
          const totalFeesUsd = Number(totalFee) / Math.pow(10, route.destination.decimals);

          rates.push({
            source: route.source,
            destination: route.destination,
            amountIn: amt,
            amountOut: data.estimated_receive_amt,
            effectiveRate,
            totalFeesUsd,
            quotedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.warn(`Error fetching rate for ${route.source.symbol}->${route.destination.symbol}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return rates;
  }

  /**
   * Fetch liquidity depth at 50bps and 100bps thresholds.
   * Simulates liquidity depth by making multiple estimate calls with increasing amounts.
   * Returns exactly 2 thresholds: 50bps and 100bps.
   */
  async getLiquidityDepth(
    routes: RouteType<CBridgeAssetType>[]
  ): Promise<LiquidityDepthType<CBridgeAssetType>[]> {
    const liquidityResults: LiquidityDepthType<CBridgeAssetType>[] = [];

    for (const route of routes) {
      try {
        const tokenSymbol = route.source.symbol;

        // Test amounts: 100, 1000, 10000, 100000, 1000000 (in token base units)
        const testAmounts = [
          BigInt(100) * BigInt(10 ** route.source.decimals),
          BigInt(1000) * BigInt(10 ** route.source.decimals),
          BigInt(10000) * BigInt(10 ** route.source.decimals),
          BigInt(100000) * BigInt(10 ** route.source.decimals),
          BigInt(1000000) * BigInt(10 ** route.source.decimals),
        ];

        let recommendedAmount: string | null = null;
        let maxAmount: string | null = null;

        // Find recommended amount (≤50bps slippage) and max amount (≤100bps slippage)
        for (const amount of testAmounts) {
          try {
            const data = await this.cBridgeClient.fetchEstimate({
              src_chain_id: route.source.chainId.toString(),
              dst_chain_id: route.destination.chainId.toString(),
              token_symbol: tokenSymbol,
              amt: amount.toString(),
              usr_addr: '0x0000000000000000000000000000000000000000',
              slippage_tolerance: 5000
            });

            if (data.err) continue;

            // Calculate slippage in basis points
            const amountIn = amount;
            const amountOut = BigInt(data.estimated_receive_amt);
            const expectedOut = amountIn;
            const slippage = expectedOut > amountOut
              ? Number((expectedOut - amountOut) * BigInt(10000) / expectedOut)
              : 0;

            // Set thresholds for the largest amount that fits within limits
            if (slippage <= 50 && recommendedAmount === null) {
              recommendedAmount = amount.toString();
            }
            if (slippage <= 100 && maxAmount === null) {
              maxAmount = amount.toString();
            }
          } catch (error) {
            // Skip this amount on error
            continue;
          }
        }

        // Return exactly 2 thresholds if we found any liquid amounts
        if (recommendedAmount && maxAmount) {
          liquidityResults.push({
            route: route,
            thresholds: [
              {
                maxAmountIn: recommendedAmount,
                slippageBps: 50,
              },
              {
                maxAmountIn: maxAmount,
                slippageBps: 100,
              }
            ],
            measuredAt: new Date().toISOString(),
          });
        } else if (recommendedAmount) {
          // Fallback: just return what we could find
          liquidityResults.push({
            route: route,
            thresholds: [
              {
                maxAmountIn: recommendedAmount,
                slippageBps: 50,
              }
            ],
            measuredAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.warn(`Error measuring liquidity depth for ${route.source.symbol}->${route.destination.symbol}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return liquidityResults;
  }

  /**
   * Fetch list of assets supported by the provider.
   * Uses cBridge's getTransferConfigsForAll endpoint.
   * Returns provider format - transformation to NEAR Intents happens in router layer.
   */
  async getListedAssets(): Promise<CBridgeAssetType[]> {
    try {
      const data = await this.cBridgeClient.fetchTransferConfigs();

      if (data.err) {
        throw new Error(`API error: ${data.err.msg}`);
      }

      const assets: CBridgeAssetType[] = [];
      const seen = new Set<string>();

      // Extract unique tokens from all chains
      for (const [chainId, chainData] of Object.entries(data.chain_token)) {
        const chain = data.chains.find((c: any) => c.id.toString() === chainId);
        if (!chain) continue;

        for (const tokenData of (chainData as any).token) {
          const key = `${chainId}-${tokenData.token.address}`;
          if (seen.has(key)) continue;
          seen.add(key);

          assets.push({
            chainId: parseInt(chainId),
            address: tokenData.token.address,
            symbol: tokenData.token.symbol,
            decimals: tokenData.token.decimal,
          });
        }
      }

      console.log(`[cBridge] Successfully fetched ${assets.length} supported assets`);
      return assets;
    } catch (error) {
      console.error(`[cBridge] Failed to fetch assets: ${error instanceof Error ? error.message : String(error)}`);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Fetch volume data from DefiLlama Bridge API with caching and retry logic.
   */
  private async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && (Date.now() - this.volumeCache.fetchedAt) < this.VOLUME_CACHE_TTL) {
      console.log("[cBridge] Using cached volume data from DefiLlama");
      return this.volumeCache.data;
    }

    try {
      const data = await this.defillamaClient.fetchBridgeVolume(this.CBRIDGE_BRIDGE_ID);

      // Validate response has expected fields
      if (typeof data.lastDailyVolume !== 'number') {
        throw new Error("Invalid response structure from DefiLlama");
      }

      // Cache the result
      this.volumeCache = {
        data,
        fetchedAt: Date.now(),
      };

      console.log(`[cBridge] Successfully fetched volumes from DefiLlama: 24h=$${data.lastDailyVolume.toLocaleString()}`);
      return data;
    } catch (error) {
      console.error(`[cBridge] Failed to fetch volumes from DefiLlama:`, error instanceof Error ? error.message : String(error));

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
