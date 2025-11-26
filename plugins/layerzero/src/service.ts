import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain, getBlockchainFromChainId } from '@data-provider/plugin-utils';
import type { AssetType } from "@data-provider/shared-contract";
import { LayerZeroApiClient, LayerZeroAssetType, StargateChain, StargateToken } from './client';

import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * Data Provider Service for LayerZero/Stargate
 *
 * LayerZero is a message passing protocol with Stargate as its bridge application.
 *
 * Key features:
 * - Chain key system (chainKey ↔ chainId mappings)
 * - Token metadata with USD pricing
 * - Binary search for liquidity depth
 * - DefiLlama integration for volumes
 */
export class LayerZeroService extends BaseDataProviderService<LayerZeroAssetType> {
  private chains: StargateChain[] | null = null;
  private tokens: StargateToken[] | null = null;

  constructor(
    private readonly client: LayerZeroApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<LayerZeroAssetType> {
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
  async transformAssetFromProvider(asset: LayerZeroAssetType): Promise<AssetType> {
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
   * Fetch volume metrics from DefiLlama Bridge API.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.client.fetchDefiLlamaVolumes();

      if (!bridgeData || typeof bridgeData.lastDailyVolume !== 'number') {
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
          default:
            console.log(`[LayerZero] Skipping unsupported volume window: ${window}`);
            continue;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now,
        });

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
   * Fetch list of assets supported by LayerZero/Stargate.
   */
  async getListedAssets(): Promise<LayerZeroAssetType[]> {
    try {
      await this.ensureMetadataLoaded();
      
      if (!this.tokens) {
        console.error("[LayerZero] Token metadata not available");
        return [];
      }

      const assets: LayerZeroAssetType[] = [];

      for (const token of this.tokens) {
        const chainId = this.getChainIdByKey(token.chainKey);
        if (!chainId) continue;

        assets.push({
          chainId,
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals
        });
      }

      console.log(`[LayerZero] Loaded ${assets.length} assets from API`);
      return assets;
    } catch (error) {
      console.error("[LayerZero] Failed to fetch assets from API:", error);
      return [];
    }
  }

  /**
   * Fetch rate quotes for route with specific amount.
   */
  async getRates(
    route: RouteType<LayerZeroAssetType>,
    amount: string
  ): Promise<RateType<LayerZeroAssetType>[]> {
    const rates: RateType<LayerZeroAssetType>[] = [];

    try {
      await this.ensureMetadataLoaded();

      const srcChainKey = this.getChainKeyById(route.source.chainId);
      const dstChainKey = this.getChainKeyById(route.destination.chainId);

      if (!srcChainKey || !dstChainKey) {
        console.error(`[LayerZero] Chain not found: ${route.source.chainId} or ${route.destination.chainId}`);
        return rates;
      }

      const amountInNum = BigInt(amount);
      const dstAmountMin = (amountInNum * BigInt(95) / BigInt(100)).toString();
      const dummyAddress = '0x0000000000000000000000000000000000000001';

      const response = await this.client.fetchQuote({
        srcToken: route.source.address,
        dstToken: route.destination.address,
        srcChainKey,
        dstChainKey,
        srcAmount: amount,
        dstAmountMin,
        srcAddress: dummyAddress,
        dstAddress: dummyAddress,
      });

      const validQuote = response.quotes.find(q => q.error === null);

      if (validQuote) {
        const effectiveRate = calculateEffectiveRate(
          validQuote.srcAmount,
          validQuote.dstAmount,
          route.source.decimals,
          route.destination.decimals
        );

        rates.push({
          source: route.source,
          destination: route.destination,
          amountIn: validQuote.srcAmount,
          amountOut: validQuote.dstAmount,
          effectiveRate,
          quotedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[LayerZero] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using binary search with srcAmountMax.
   */
  async getLiquidityDepth(
    route: RouteType<LayerZeroAssetType>
  ): Promise<LiquidityDepthType<LayerZeroAssetType>[]> {
    try {
      await this.ensureMetadataLoaded();

      const baselineAmount = this.getTestAmount(route.source);
      const srcChainKey = this.getChainKeyById(route.source.chainId);
      const dstChainKey = this.getChainKeyById(route.destination.chainId);

      if (!srcChainKey || !dstChainKey) {
        console.warn(`[LayerZero] No chain keys for liquidity measurement`);
        return [];
      }

      const dummyAddress = '0x0000000000000000000000000000000000000001';
      const response = await this.client.fetchQuote({
        srcToken: route.source.address,
        dstToken: route.destination.address,
        srcChainKey,
        dstChainKey,
        srcAmount: baselineAmount,
        dstAmountMin: (BigInt(baselineAmount) * BigInt(95) / BigInt(100)).toString(),
        srcAddress: dummyAddress,
        dstAddress: dummyAddress,
      });

      const baselineQuote = response.quotes.find(q => q.error === null);

      if (!baselineQuote || !baselineQuote.srcAmountMax) {
        console.warn(`[LayerZero] No baseline quote for liquidity depth`);
        return [];
      }

      let maxLiquidity: bigint;
      try {
        maxLiquidity = BigInt(baselineQuote.srcAmountMax);
        if (maxLiquidity <= 0) {
          console.warn(`[LayerZero] Invalid srcAmountMax, skipping`);
          return [];
        }
        const maxReasonable = BigInt(10) ** BigInt(30);
        if (maxLiquidity > maxReasonable) {
          console.warn(`[LayerZero] Suspiciously large srcAmountMax, capping`);
          maxLiquidity = maxReasonable;
        }
      } catch (error) {
        console.error(`[LayerZero] Invalid srcAmountMax format:`, error);
        return [];
      }

      const baselineRate = calculateEffectiveRate(
        baselineQuote.srcAmount,
        baselineQuote.dstAmount,
        route.source.decimals,
        route.destination.decimals
      );

      const maxAt50bps = await this.findMaxAmountAtSlippage(
        route,
        baselineRate,
        BigInt(baselineAmount),
        maxLiquidity,
        50
      );

      const maxAt100bps = await this.findMaxAmountAtSlippage(
        route,
        baselineRate,
        BigInt(baselineAmount),
        maxLiquidity,
        100
      );

      return [{
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
      }];
    } catch (error) {
      console.error("[LayerZero] Failed to fetch liquidity depth:", error);
      return [];
    }
  }

  /**
   * Binary search to find maximum amount within slippage threshold.
   */
  private async findMaxAmountAtSlippage(
    route: RouteType<LayerZeroAssetType>,
    baselineRate: number,
    minAmount: bigint,
    maxAmount: bigint,
    slippageBps: number
  ): Promise<bigint> {
    const maxIterations = 8;
    let left = minAmount;
    let right = maxAmount;
    let bestAmount = minAmount;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const mid = (left + right) / BigInt(2);

      if (mid <= left || mid >= right) {
        break;
      }

      try {
        const srcChainKey = this.getChainKeyById(route.source.chainId);
        const dstChainKey = this.getChainKeyById(route.destination.chainId);

        if (!srcChainKey || !dstChainKey) break;

        const dummyAddress = '0x0000000000000000000000000000000000000001';
        const response = await this.client.fetchQuote({
          srcToken: route.source.address,
          dstToken: route.destination.address,
          srcChainKey,
          dstChainKey,
          srcAmount: mid.toString(),
          dstAmountMin: (mid * BigInt(95) / BigInt(100)).toString(),
          srcAddress: dummyAddress,
          dstAddress: dummyAddress,
        });

        const quote = response.quotes.find(q => q.error === null);

        if (!quote) {
          right = mid;
          continue;
        }

        const rate = calculateEffectiveRate(
          quote.srcAmount,
          quote.dstAmount,
          route.source.decimals,
          route.destination.decimals
        );

        const slippage = Math.abs(rate - baselineRate) / baselineRate;
        const slippageInBps = slippage * 10000;

        console.log(`[LayerZero] Binary search iteration ${iteration + 1}: amount=${mid.toString()}, slippage=${slippageInBps.toFixed(2)}bps`);

        if (slippageInBps <= slippageBps) {
          bestAmount = mid;
          left = mid;
        } else {
          right = mid;
        }
      } catch (error) {
        console.warn(`[LayerZero] Quote failed during binary search at amount ${mid.toString()}`);
        right = mid;
      }
    }

    return bestAmount;
  }

  /**
   * Get test amount for liquidity checks (1 unit of token).
   */
  private getTestAmount(asset: LayerZeroAssetType): string {
    return Math.pow(10, asset.decimals).toString();
  }

  /**
   * Ensure chains and tokens metadata is loaded.
   */
  private async ensureMetadataLoaded(): Promise<void> {
    if (!this.chains) {
      const response = await this.client.fetchChains();
      this.chains = response.chains;
    }
    if (!this.tokens) {
      const response = await this.client.fetchTokens();
      this.tokens = response.tokens;
    }
  }

  /**
   * Get chain key by numeric chain ID.
   */
  private getChainKeyById(chainId: string): string | null {
    if (!this.chains) return null;
    const chain = this.chains.find(c => c.chainId.toString() === chainId);
    return chain?.chainKey || null;
  }

  /**
   * Get numeric chain ID by chain key.
   */
  private getChainIdByKey(chainKey: string): string | null {
    if (!this.chains) return null;
    const chain = this.chains.find(c => c.chainKey === chainKey);
    return chain?.chainId.toString() || null;
  }
}
