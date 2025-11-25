import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain } from '@data-provider/plugin-utils';
import type { AssetType } from "@data-provider/shared-contract";
import { AcrossApiClient, AcrossAssetType } from './client';

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
   * Fetch rate quotes for route/notional combinations.
   *
   * Uses Across suggested-fees API to get detailed fee breakdown.
   * All amounts are kept in smallest units (wei) as per contract specification.
   */
  async getRates(
    route: RouteType<AcrossAssetType>,
    notionals: string[]
  ): Promise<RateType<AcrossAssetType>[]> {
    const rates: RateType<AcrossAssetType>[] = [];

    for (const notional of notionals) {
      try {
        const fees = await this.client.fetchSuggestedFees({
          inputToken: route.source.address,
          outputToken: route.destination.address,
          originChainId: route.source.chainId,
          destinationChainId: route.destination.chainId,
          amount: notional
        });

        const amountInWei = BigInt(notional);
        const relayFeeWei = BigInt(fees.totalRelayFee.total);
        const amountOutWei = amountInWei - relayFeeWei;

        const effectiveRate = calculateEffectiveRate(
          amountInWei.toString(),
          amountOutWei.toString(),
          route.source.decimals,
          route.destination.decimals
        );

        rates.push({
          source: route.source,
          destination: route.destination,
          amountIn: amountInWei.toString(),
          amountOut: amountOutWei.toString(),
          effectiveRate,
          quotedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[Across] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
      }
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using Across limits API with verified cost measurement.
   */
  async getLiquidityDepth(
    route: RouteType<AcrossAssetType>
  ): Promise<LiquidityDepthType<AcrossAssetType>[]> {
    const liquidity: LiquidityDepthType<AcrossAssetType>[] = [];

    try {
      const limits = await this.client.fetchLimits({
        inputToken: route.source.address,
        outputToken: route.destination.address,
        originChainId: route.source.chainId,
        destinationChainId: route.destination.chainId
      });

      const baselineAmount = limits.minDeposit;
      const baselineFees = await this.client.fetchSuggestedFees({
        inputToken: route.source.address,
        outputToken: route.destination.address,
        originChainId: route.source.chainId,
        destinationChainId: route.destination.chainId,
        amount: baselineAmount
      });

      const baselineRate = calculateEffectiveRate(
        baselineAmount,
        (BigInt(baselineAmount) - BigInt(baselineFees.totalRelayFee.total)).toString(),
        route.source.decimals,
        route.destination.decimals
      );

      const thresholds: Array<{ maxAmountIn: string; slippageBps: number }> = [];

      const candidateAmounts = [
        { amount: limits.recommendedDepositInstant, label: 'recommended' },
        { amount: limits.maxDepositInstant, label: 'max' }
      ];

      for (const candidate of candidateAmounts) {
        try {
          const fees = await this.client.fetchSuggestedFees({
            inputToken: route.source.address,
            outputToken: route.destination.address,
            originChainId: route.source.chainId,
            destinationChainId: route.destination.chainId,
            amount: candidate.amount
          });

          const currentRate = calculateEffectiveRate(
            candidate.amount,
            (BigInt(candidate.amount) - BigInt(fees.totalRelayFee.total)).toString(),
            route.source.decimals,
            route.destination.decimals
          );

          const slippageBps = Math.abs(currentRate / baselineRate - 1) * 10000;

          if (slippageBps <= 50) {
            const existing50 = thresholds.find(t => t.slippageBps === 50);
            if (!existing50 || parseFloat(candidate.amount) > parseFloat(existing50.maxAmountIn)) {
              if (existing50) {
                existing50.maxAmountIn = candidate.amount;
              } else {
                thresholds.push({ maxAmountIn: candidate.amount, slippageBps: 50 });
              }
            }
          }

          if (slippageBps <= 100) {
            const existing100 = thresholds.find(t => t.slippageBps === 100);
            if (!existing100 || parseFloat(candidate.amount) > parseFloat(existing100.maxAmountIn)) {
              if (existing100) {
                existing100.maxAmountIn = candidate.amount;
              } else {
                thresholds.push({ maxAmountIn: candidate.amount, slippageBps: 100 });
              }
            }
          }

          console.log(`[Across] ${candidate.label} amount ${candidate.amount} has ${slippageBps.toFixed(2)}bps slippage`);
        } catch (error) {
          console.error(`[Across] Failed to probe ${candidate.label} amount:`, error);
        }
      }

      liquidity.push({
        route,
        thresholds,
        measuredAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[Across] Failed to fetch liquidity for ${route.source.symbol}:`, error);
      liquidity.push({
        route,
        thresholds: [],
        measuredAt: new Date().toISOString(),
      });
    }

    return liquidity;
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
