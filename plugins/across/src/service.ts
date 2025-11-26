import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain, getBlockchainFromChainId, getDefaultRecipient } from '@data-provider/plugin-utils';
import type { AssetType } from "@data-provider/shared-contract";
import { AcrossApiClient, AcrossAssetType } from './client';
import { Effect } from 'every-plugin/effect';

import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

export class AcrossService extends BaseDataProviderService<AcrossAssetType> {
  private readonly ACROSS_BRIDGE_ID = "19";

  constructor(
    private readonly client: AcrossApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<AcrossAssetType> {
    const identity = await assetToCanonicalIdentity(asset);
    const chainId = getChainIdFromBlockchain(identity.blockchain);

    if (!chainId) {
      throw new Error(`Unable to resolve chain for asset: ${identity.assetId}`);
    }

    return {
      chainId,
      name: identity.assetId,
      address: identity.reference,
      symbol: asset.symbol,
      decimals: asset.decimals
    };
  }

  /**
   * Transform provider-specific asset to canonical AssetType format.
   */
  async transformAssetFromProvider(asset: AcrossAssetType): Promise<AssetType> {
    const identity = await assetToCanonicalIdentity({
      chainId: asset.chainId,
      address: asset.address
    });

    return canonicalToAsset(identity, {
      symbol: asset.symbol,
      decimals: asset.decimals,
      iconUrl: asset.logoUrl,
      chainId: asset.chainId
    });
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
      const bridgeData = await this.client.fetchDefiLlamaVolumes(this.ACROSS_BRIDGE_ID);

      if (!bridgeData || typeof bridgeData.lastDailyVolume !== 'number') {
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
   * Fetch rate quote for route with specific amount.
   *
   * Uses Across /swap/approval API to get accurate output amounts including swap impact.
   * All amounts are kept in smallest units (wei) as per contract specification.
   */
  async getRates(
    route: RouteType<AcrossAssetType>,
    amount: string
  ): Promise<RateType<AcrossAssetType>[]> {
    const rates: RateType<AcrossAssetType>[] = [];

    const destinationBlockchain = getBlockchainFromChainId(route.destination.chainId);
    if (!destinationBlockchain) {
      console.error(`[Across] Unable to resolve blockchain for chainId ${route.destination.chainId}`);
      return rates;
    }

    const recipient = getDefaultRecipient(destinationBlockchain);
    const depositor = getDefaultRecipient(getBlockchainFromChainId(route.source.chainId) ?? "eth");

    try {
      const approval = await this.client.fetchApproval({
        inputToken: route.source.address,
        outputToken: route.destination.address,
        originChainId: route.source.chainId,
        destinationChainId: route.destination.chainId,
        amount,
        depositor,
        recipient
      });

      const effectiveRate = calculateEffectiveRate(
        approval.inputAmount,
        approval.expectedOutputAmount,
        route.source.decimals,
        route.destination.decimals
      );

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn: approval.inputAmount,
        amountOut: approval.expectedOutputAmount,
        effectiveRate,
        quotedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Across] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using smart probing with parallel API calls.
   * Tests multiple amounts concurrently and uses binary search for precise threshold detection.
   */
  async getLiquidityDepth(
    route: RouteType<AcrossAssetType>
  ): Promise<LiquidityDepthType<AcrossAssetType>[]> {
    const self = this;

    const result = await Effect.gen(function* () {
      const limits = yield* Effect.tryPromise({
        try: () => self.client.fetchLimits({
          inputToken: route.source.address,
          outputToken: route.destination.address,
          originChainId: route.source.chainId,
          destinationChainId: route.destination.chainId
        }),
        catch: (error) => new Error(`Failed to fetch limits: ${error}`)
      });

      const baselineAmount = limits.minDeposit;
      const baselineFees = yield* Effect.tryPromise({
        try: () => self.client.fetchSuggestedFees({
          inputToken: route.source.address,
          outputToken: route.destination.address,
          originChainId: route.source.chainId,
          destinationChainId: route.destination.chainId,
          amount: baselineAmount
        }),
        catch: (error) => new Error(`Failed to fetch baseline fees: ${error}`)
      });

      const baselineRate = calculateEffectiveRate(
        baselineAmount,
        (BigInt(baselineAmount) - BigInt(baselineFees.totalRelayFee.total)).toString(),
        route.source.decimals,
        route.destination.decimals
      );

      const decimals = route.source.decimals;
      const unit = BigInt(10 ** decimals);
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

      console.log(`[Across] Testing ${probeAmounts.length} amounts in parallel for ${route.source.symbol} -> ${route.destination.symbol}`);

      const probeResults = yield* Effect.forEach(
        probeAmounts,
        ({ amount, index }) => Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () => {
              const fees = await self.client.fetchSuggestedFees({
                inputToken: route.source.address,
                outputToken: route.destination.address,
                originChainId: route.source.chainId,
                destinationChainId: route.destination.chainId,
                amount: amount.toString()
              });

              const currentRate = calculateEffectiveRate(
                amount.toString(),
                (BigInt(amount.toString()) - BigInt(fees.totalRelayFee.total)).toString(),
                route.source.decimals,
                route.destination.decimals
              );

              const slippageBps = Math.abs(currentRate / baselineRate - 1) * 10000;

              return { amount, index, slippageBps, success: true as const };
            },
            catch: () => ({ amount, index, success: false as const })
          });

          return result;
        }),
        { concurrency: "unbounded" }
      );

      probeResults.sort((a, b) => a.index - b.index);

      const successfulProbes = probeResults.filter(r => r.success && 'slippageBps' in r);
      console.log(`[Across] Successfully probed ${successfulProbes.length}/${probeAmounts.length} amounts`);

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
        console.log(`[Across] Binary searching for 50bps limit between ${lastSuccess50bps} and ${firstFailure50bps}`);
        binarySearchEffects.push(
          Effect.tryPromise({
            try: async () => {
              maxAmount50bps = await self.binarySearchMaxAmount(
                route,
                baselineRate,
                lastSuccess50bps!,
                firstFailure50bps!,
                50
              );
            },
            catch: (error) => new Error(`Binary search 50bps failed: ${error}`)
          }).pipe(Effect.catchAll(() => Effect.void))
        );
      } else if (lastSuccess50bps) {
        maxAmount50bps = lastSuccess50bps.toString();
      }

      if (lastSuccess100bps && firstFailure100bps && lastSuccess100bps < firstFailure100bps) {
        console.log(`[Across] Binary searching for 100bps limit between ${lastSuccess100bps} and ${firstFailure100bps}`);
        binarySearchEffects.push(
          Effect.tryPromise({
            try: async () => {
              maxAmount100bps = await self.binarySearchMaxAmount(
                route,
                baselineRate,
                lastSuccess100bps!,
                firstFailure100bps!,
                100
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

      console.log(`[Across] Measured liquidity - 50bps: ${maxAmount50bps || 'N/A'}, 100bps: ${maxAmount100bps || 'N/A'}`);

      return {
        route,
        thresholds,
        measuredAt: new Date().toISOString(),
      };
    }).pipe(
      Effect.catchAll((error) => {
        console.error(`[Across] Failed to fetch liquidity for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
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

  private async binarySearchMaxAmount(
    route: RouteType<AcrossAssetType>,
    baselineRate: number,
    minAmount: bigint,
    maxAmount: bigint,
    slippageThresholdBps: number
  ): Promise<string | undefined> {
    const maxIterations = 10;
    let iterations = 0;
    let low = minAmount;
    let high = maxAmount;
    let bestAmount: bigint | undefined;

    while (low <= high && iterations < maxIterations) {
      iterations++;
      const mid = (low + high) / BigInt(2);

      try {
        const fees = await this.client.fetchSuggestedFees({
          inputToken: route.source.address,
          outputToken: route.destination.address,
          originChainId: route.source.chainId,
          destinationChainId: route.destination.chainId,
          amount: mid.toString()
        });

        const currentRate = calculateEffectiveRate(
          mid.toString(),
          (BigInt(mid.toString()) - BigInt(fees.totalRelayFee.total)).toString(),
          route.source.decimals,
          route.destination.decimals
        );

        const slippageBps = Math.abs(currentRate / baselineRate - 1) * 10000;

        if (slippageBps <= slippageThresholdBps) {
          bestAmount = mid;
          low = mid + BigInt(1);
        } else {
          high = mid - BigInt(1);
        }
      } catch (error) {
        console.warn(`[Across] Binary search probe failed at ${mid}:`, error);
        high = mid - BigInt(1);
      }
    }

    console.log(`[Across] Binary search completed in ${iterations} iterations for ${slippageThresholdBps}bps`);
    return bestAmount?.toString();
  }

  /**
   * Fetch list of assets supported by Across.
   */
  async getListedAssets(): Promise<AcrossAssetType[]> {
    try {
      const tokens = await this.client.fetchTokens();

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
}
