import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain } from '@data-provider/plugin-utils';
import Decimal from 'decimal.js';
import { CBridgeApiClient, CBridgeAssetType, CBridgeTransferConfigs } from './client';

import type {
  AssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * Data Provider Service for cBridge
 *
 * cBridge is Celer Network's cross-chain bridge.
 *
 * Key features:
 * - Multi-chain support
 * - Quote simulation for liquidity estimation
 * - No public volume API (returns empty arrays)
 */
export class CBridgeService extends BaseDataProviderService<CBridgeAssetType> {
  private transferConfigs: CBridgeTransferConfigs | null = null;

  constructor(
    private readonly client: CBridgeApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<CBridgeAssetType> {
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
  async transformAssetFromProvider(asset: CBridgeAssetType): Promise<AssetType> {
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
   * Get volumes (no public API available, returns empty array).
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    console.log("[cBridge] No public volume API available");
    return [];
  }

  /**
   * Fetch list of assets supported by cBridge.
   */
  async getListedAssets(): Promise<CBridgeAssetType[]> {
    try {
      await this.ensureConfigsLoaded();

      if (!this.transferConfigs) {
        console.error("[cBridge] Transfer configs not available");
        return [];
      }

      const assets: CBridgeAssetType[] = [];

      for (const [chainId, chainData] of Object.entries(this.transferConfigs.chain_token)) {
        if (!chainData?.token || !Array.isArray(chainData.token)) {
          continue;
        }

        for (const tokenData of chainData.token) {
          if (!tokenData?.token || tokenData.token.xfer_disabled) {
            continue;
          }

          assets.push({
            chainId,
            address: tokenData.token.address,
            symbol: tokenData.token.symbol,
            decimals: tokenData.token.decimal
          });
        }
      }

      console.log(`[cBridge] Loaded ${assets.length} assets from API`);
      return assets;
    } catch (error) {
      console.error("[cBridge] Failed to fetch assets from API:", error);
      return [];
    }
  }

  /**
   * Fetch rate quotes using cBridge estimate API.
   */
  async getRates(
    route: RouteType<CBridgeAssetType>,
    amount: string
  ): Promise<RateType<CBridgeAssetType>[]> {
    const rates: RateType<CBridgeAssetType>[] = [];

    try {
      const dummyAddress = '0x0000000000000000000000000000000000000001';

      const estimate = await this.client.fetchEstimateAmount({
        src_chain_id: parseInt(route.source.chainId, 10),
        dst_chain_id: parseInt(route.destination.chainId, 10),
        token_symbol: route.source.symbol,
        amt: amount,
        usr_addr: dummyAddress,
        slippage_tolerance: 500
      });

      if (estimate.err && estimate.err.code !== 0) {
        console.error(`[cBridge] Estimate error: ${estimate.err.msg}`);
        return rates;
      }

      const effectiveRate = calculateEffectiveRate(
        amount,
        estimate.estimated_receive_amt,
        route.source.decimals,
        route.destination.decimals
      );

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn: amount,
        amountOut: estimate.estimated_receive_amt,
        effectiveRate,
        quotedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[cBridge] Failed to get rate for ${route.source.symbol} -> ${route.destination.symbol}:`, error);
    }

    return rates;
  }

  /**
   * Estimate liquidity depth using quote simulation.
   */
  async getLiquidityDepth(
    route: RouteType<CBridgeAssetType>
  ): Promise<LiquidityDepthType<CBridgeAssetType>[]> {
    const liquidity: LiquidityDepthType<CBridgeAssetType>[] = [];

    try {
      const thresholds = [];
      const dummyAddress = '0x0000000000000000000000000000000000000001';

      const testAmounts = [
        new Decimal('100').times(Math.pow(10, route.source.decimals)),
        new Decimal('1000').times(Math.pow(10, route.source.decimals)),
        new Decimal('10000').times(Math.pow(10, route.source.decimals)),
        new Decimal('100000').times(Math.pow(10, route.source.decimals))
      ];

      for (const amount of testAmounts) {
        try {
          const estimate = await this.client.fetchEstimateAmount({
            src_chain_id: parseInt(route.source.chainId, 10),
            dst_chain_id: parseInt(route.destination.chainId, 10),
            token_symbol: route.source.symbol,
            amt: amount.toString(),
            usr_addr: dummyAddress,
            slippage_tolerance: 500
          });

          if (!estimate.err || estimate.err.code === 0) {
            const slippageBps = amount.gt(testAmounts[2]!) ? 100 : 50;

            thresholds.push({
              maxAmountIn: amount.toString(),
              slippageBps,
            });
          }
        } catch (error) {
          console.warn(`[cBridge] Quote failed for amount ${amount.toString()}`);
          break;
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
      console.error("[cBridge] Failed to estimate liquidity depth:", error);
    }

    return liquidity;
  }

  /**
   * Ensure transfer configs are loaded.
   */
  private async ensureConfigsLoaded(): Promise<void> {
    if (!this.transferConfigs) {
      this.transferConfigs = await this.client.fetchTransferConfigs();
    }
  }
}
