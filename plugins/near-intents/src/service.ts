import { DataProviderService as BaseDataProviderService, calculateEffectiveRate, assetToCanonicalIdentity, canonicalToAsset, getChainNamespace, getDefaultRecipient } from "@data-provider/plugin-utils";
import type {
  AssetType, LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from "@data-provider/shared-contract";
import { QuoteRequest } from "@defuse-protocol/one-click-sdk-typescript";
import { Effect } from "every-plugin/effect";
import { IntentsAssetType, IntentsClient } from "./client";

export class IntentsService extends BaseDataProviderService<IntentsAssetType> {
  private canonicalToProvider = new Map<string, IntentsAssetType>();

  constructor(private readonly client: IntentsClient) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   * Looks up from cache only
   */
  async transformAssetToProvider(asset: AssetType): Promise<IntentsAssetType> {
    const identity = await assetToCanonicalIdentity(asset);
    const key = identity.assetId.toLowerCase();

    const existing = this.canonicalToProvider.get(key);
    if (!existing) {
      throw new Error(
        `[NEAR Intents] Canonical asset ${identity.assetId} not supported by 1Click`
      );
    }

    return existing;
  }

  /**
   * Transform provider-specific asset to canonical AssetType format.
   */
  async transformAssetFromProvider(
    asset: IntentsAssetType,
  ): Promise<AssetType> {
    try {
      const { namespace, reference } = getChainNamespace(
        asset.blockchain,
        asset.contractAddress,
      );

      const identity = await assetToCanonicalIdentity({
        blockchain: asset.blockchain,
        namespace,
        reference,
      });

      const canonical = canonicalToAsset(identity, {
        symbol: asset.symbol,
        decimals: asset.decimals,
      });

      this.canonicalToProvider.set(canonical.assetId.toLowerCase(), asset);

      return canonical;
    } catch (error) {
      console.warn(
        `[NEAR Intents] Failed to convert asset ${asset.symbol} (blockchain: ${asset.blockchain}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetch volume metrics using DefiLlama DEX volume data.
   * Supports cumulative window in addition to standard time periods.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const summary = await this.client.fetchDexSummary();
      const measuredAt = new Date().toISOString();
      const volumes: { window: TimeWindow; volumeUsd: number; measuredAt: string }[] = [];

      for (const window of windows) {
        let volumeUsd = 0;

        switch (window) {
          case "24h":
            volumeUsd = summary.total24h ?? 0;
            break;
          case "7d":
            volumeUsd = summary.total7d ?? 0;
            break;
          case "30d":
            volumeUsd = summary.total30d ?? 0;
            break;
          case "all":
            volumeUsd = summary.totalAllTime ?? 0;
            break;
        }

        volumes.push({ window, volumeUsd, measuredAt });

        console.log(`[NEAR Intents] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[NEAR Intents] Failed to fetch DEX volume from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString(),
      }));
    }
  }

  /**
   * Fetch list of assets supported by NEAR Intents using 1Click API.
   */
  async getListedAssets(): Promise<IntentsAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

      // Map 1Click TokenResponse to IntentsAssetType
      // Deduplicate by (blockchain, assetId) to avoid duplicates
      const assetMap = new Map<string, IntentsAssetType>();

      for (const token of tokens) {
        const key = `${token.blockchain}:${token.assetId}`;

        if (!assetMap.has(key)) {
          assetMap.set(key, {
            blockchain: token.blockchain,
            intentsAssetId: token.assetId,
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
   * Fetch rate quote for route using 1Click API.
   */
  async getRates(route: RouteType<IntentsAssetType>, amount: string): Promise<RateType<IntentsAssetType>[]> {
    const rates: RateType<IntentsAssetType>[] = [];

    if (route.source.intentsAssetId === route.destination.intentsAssetId) {
      console.log(`[NEAR Intents] Skipping same-asset route: ${route.source.intentsAssetId}`);
      return rates;
    }

    try {
      const quoteRequest: QuoteRequest = {
        dry: true,
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance: 100,
        originAsset: route.source.intentsAssetId,
        depositType: QuoteRequest.depositType.INTENTS,
        destinationAsset: route.destination.intentsAssetId,
        amount,
        refundTo: getDefaultRecipient(route.source.blockchain),
        refundType: QuoteRequest.refundType.INTENTS,
        recipient: getDefaultRecipient(route.destination.blockchain),
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        sessionId: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      };

      const response = await this.client.fetchQuote(quoteRequest);

      const quote = response.quote;
      const amountIn = quote.amountIn;
      const amountOut = quote.amountOut;

      const effectiveRate = calculateEffectiveRate(
        amountIn,
        amountOut,
        route.source.decimals,
        route.destination.decimals
      );

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn,
        amountOut,
        effectiveRate,
        quotedAt: response.timestamp || new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[NEAR Intents] Failed to get rate for ${route.source.symbol} (${route.source.intentsAssetId}) -> ` +
        `${route.destination.symbol} (${route.destination.intentsAssetId}) with amount ${amount}: ${errorMessage}`
      );
    }

    console.log(`[NEAR Intents] Successfully fetched ${rates.length} rate for route`);
    return rates;
  }

  private async testQuoteAtAmount(
    route: RouteType<IntentsAssetType>,
    amount: string
  ): Promise<{ success: boolean; rate?: number }> {
    try {
      const response = await this.client.fetchQuote({
        dry: true,
        swapType: QuoteRequest.swapType.EXACT_INPUT,
        slippageTolerance: 1,
        originAsset: route.source.intentsAssetId,
        depositType: QuoteRequest.depositType.INTENTS,
        destinationAsset: route.destination.intentsAssetId,
        amount,
        refundTo: getDefaultRecipient(route.source.blockchain),
        refundType: QuoteRequest.refundType.INTENTS,
        recipient: getDefaultRecipient(route.destination.blockchain),
        recipientType: QuoteRequest.recipientType.DESTINATION_CHAIN,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        sessionId: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      });

      const rate = calculateEffectiveRate(
        response.quote.amountIn,
        response.quote.amountOut,
        route.source.decimals,
        route.destination.decimals
      );

      return { success: true, rate };
    } catch (error) {
      return { success: false };
    }
  }

  private async binarySearchMaxAmount(
    route: RouteType<IntentsAssetType>,
    baselineRate: number,
    minAmount: bigint,
    maxAmount: bigint,
    slippageThresholdBps: number,
    decimals: number
  ): Promise<string | undefined> {
    const maxIterations = 10;
    let iterations = 0;
    let low = minAmount;
    let high = maxAmount;
    let bestAmount: bigint | undefined;

    while (low <= high && iterations < maxIterations) {
      iterations++;
      const mid = (low + high) / BigInt(2);
      const midAmount = mid.toString();

      const result = await this.testQuoteAtAmount(route, midAmount);

      if (result.success && result.rate !== undefined) {
        const slippageBps = Math.abs(result.rate / baselineRate - 1) * 10000;

        if (slippageBps <= slippageThresholdBps) {
          bestAmount = mid;
          low = mid + BigInt(1);
        } else {
          high = mid - BigInt(1);
        }
      } else {
        high = mid - BigInt(1);
      }
    }

    return bestAmount?.toString();
  }

  /**
   * Fetch liquidity depth at 50bps and 100bps thresholds using parallel smart probing.
   */
  async getLiquidityDepth(route: RouteType<IntentsAssetType>): Promise<LiquidityDepthType<IntentsAssetType>[]> {
    const self = this;
    
    const result = await Effect.gen(function* () {
      const decimals = route.source.decimals;
      const unit = BigInt(10 ** decimals);

      const baselineAmount = (BigInt(100) * unit).toString();
      const baselineResult = yield* Effect.tryPromise({
        try: () => self.testQuoteAtAmount(route, baselineAmount),
        catch: (error) => new Error(`Baseline test failed: ${error}`)
      });

      if (!baselineResult.success || baselineResult.rate === undefined) {
        console.error(`[NEAR Intents] Failed to get baseline rate for liquidity measurement`);
        return {
          route,
          thresholds: [],
          measuredAt: new Date().toISOString(),
        };
      }

      const baselineRate = baselineResult.rate;

      const probeAmounts = [
        { amount: BigInt(1000) * unit, index: 0 },
        { amount: BigInt(5000) * unit, index: 1 },
        { amount: BigInt(10000) * unit, index: 2 },
        { amount: BigInt(20000) * unit, index: 3 },
        { amount: BigInt(50000) * unit, index: 4 },
        { amount: BigInt(100000) * unit, index: 5 },
        { amount: BigInt(200000) * unit, index: 6 },
        { amount: BigInt(500000) * unit, index: 7 },
      ];

      const probeResults = yield* Effect.forEach(
        probeAmounts,
        ({ amount, index }) => Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => self.testQuoteAtAmount(route, amount.toString()),
            catch: () => ({ success: false as const })
          });

          if (result.success && result.rate !== undefined) {
            const slippageBps = Math.abs(result.rate / baselineRate - 1) * 10000;
            return { amount, index, slippageBps, success: true as const };
          }
          return { amount, index, success: false as const };
        }),
        { concurrency: "unbounded" }
      );

      probeResults.sort((a, b) => a.index - b.index);

      let lastSuccess50bps: bigint | undefined;
      let firstFailure50bps: bigint | undefined;
      let lastSuccess100bps: bigint | undefined;
      let firstFailure100bps: bigint | undefined;

      for (const result of probeResults) {
        if (result.success && 'slippageBps' in result) {
          if (result.slippageBps <= 50) {
            lastSuccess50bps = result.amount;
          } else if (!firstFailure50bps) {
            firstFailure50bps = result.amount;
          }

          if (result.slippageBps <= 100) {
            lastSuccess100bps = result.amount;
          } else if (!firstFailure100bps) {
            firstFailure100bps = result.amount;
          }

          if (firstFailure50bps && firstFailure100bps) {
            break;
          }
        } else {
          if (!firstFailure50bps) firstFailure50bps = result.amount;
          if (!firstFailure100bps) firstFailure100bps = result.amount;
          break;
        }
      }

      let maxAmount50bps: string | undefined;
      let maxAmount100bps: string | undefined;

      const binarySearchEffects: Effect.Effect<void, Error>[] = [];

      if (lastSuccess50bps && firstFailure50bps && lastSuccess50bps < firstFailure50bps) {
        console.log(`[NEAR Intents] Binary searching for 50bps limit between ${lastSuccess50bps} and ${firstFailure50bps}`);
        binarySearchEffects.push(
          Effect.tryPromise({
            try: async () => {
              maxAmount50bps = await self.binarySearchMaxAmount(
                route,
                baselineRate,
                lastSuccess50bps!,
                firstFailure50bps!,
                50,
                decimals
              );
            },
            catch: (error) => new Error(`Binary search 50bps failed: ${error}`)
          }).pipe(Effect.catchAll(() => Effect.void))
        );
      } else if (lastSuccess50bps) {
        maxAmount50bps = lastSuccess50bps.toString();
      }

      if (lastSuccess100bps && firstFailure100bps && lastSuccess100bps < firstFailure100bps) {
        console.log(`[NEAR Intents] Binary searching for 100bps limit between ${lastSuccess100bps} and ${firstFailure100bps}`);
        binarySearchEffects.push(
          Effect.tryPromise({
            try: async () => {
              maxAmount100bps = await self.binarySearchMaxAmount(
                route,
                baselineRate,
                lastSuccess100bps!,
                firstFailure100bps!,
                100,
                decimals
              );
            },
            catch: (error) => new Error(`Binary search 100bps failed: ${error}`)
          }).pipe(Effect.catchAll(() => Effect.void))
        );
      } else if (lastSuccess100bps) {
        maxAmount100bps = lastSuccess100bps.toString();
      }

      if (binarySearchEffects.length > 0) {
        yield* Effect.all(binarySearchEffects, { concurrency: "unbounded" });
      }

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

      console.log(`[NEAR Intents] Measured liquidity - 50bps: ${maxAmount50bps || 'N/A'}, 100bps: ${maxAmount100bps || 'N/A'}`);

      return {
        route,
        thresholds,
        measuredAt: new Date().toISOString(),
      };
    }).pipe(
      Effect.catchAll((error) => {
        console.error(`[NEAR Intents] Failed to fetch liquidity for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
        return Effect.succeed({
          route,
          thresholds: [],
          measuredAt: new Date().toISOString(),
        });
      }),
      Effect.runPromise
    );

    return [result];
  }
}
