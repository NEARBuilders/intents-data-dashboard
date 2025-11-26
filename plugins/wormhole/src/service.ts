import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain, getBlockchainFromChainId } from '@data-provider/plugin-utils';
import { WormholeApiClient, WormholeAssetType } from './client';

import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType,
  AssetType
} from '@data-provider/shared-contract';

/**
 * Data Provider Service for Wormhole
 *
 * Wormhole is a message passing protocol that enables cross-chain transfers.
 * Unlike DEXs, Wormhole transfers are 1:1 (bridge same token wrapped/native).
 *
 * Key features:
 * - No exchange rate (transfers same token)
 * - Governor limits constrain transaction sizes and daily volumes
 * - Public API via Wormholescan (no API key required)
 * - DefiLlama integration for volume metrics
 *
 * Data sources:
 * - Volume: DefiLlama Bridge API (bridge ID 77)
 * - Liquidity limits: Governor API limits per chain
 * - Fee quotes: Protocol fee (0.01%) + chain-specific relayer fees
 * - Asset list: Wormholescan token list API
 */
export class WormholeService extends BaseDataProviderService<WormholeAssetType> {
  constructor(
    private readonly client: WormholeApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<WormholeAssetType> {
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
  async transformAssetFromProvider(asset: WormholeAssetType): Promise<AssetType> {
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
        console.warn("[Wormhole] No volume data available from DefiLlama");
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
            console.log(`[Wormhole] Skipping unsupported volume window: ${window}`);
            continue;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now,
        });

        console.log(`[Wormhole] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[Wormhole] Failed to fetch volumes from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch list of assets supported by Wormhole using Wormholescan API.
   */
  async getListedAssets(): Promise<WormholeAssetType[]> {
    try {
      const tokens = await this.client.fetchTokenList();
      const assets: WormholeAssetType[] = [];

      for (const token of tokens) {
        if (!token.platforms || typeof token.platforms !== 'object') {
          continue;
        }

        for (const [chainName, address] of Object.entries(token.platforms)) {
          if (!address || typeof address !== 'string') {
            continue;
          }

          const chainId = getChainIdFromBlockchain(chainName);
          if (!chainId) {
            continue;
          }

          assets.push({
            chainId: chainId.toString(),
            address,
            symbol: token.symbol,
            decimals: 18,
          });
        }
      }

      console.log(`[Wormhole] Loaded ${assets.length} assets from API`);
      return assets;
    } catch (error) {
      console.error("[Wormhole] Failed to fetch assets from API:", error);
      return [];
    }
  }

  async getRates(
    route: RouteType<WormholeAssetType>,
    amount: string
  ): Promise<RateType<WormholeAssetType>[]> {
    try {
      const amountInNum = parseFloat(amount);
      const protocolFee = amountInNum * 0.0001;
      const amountOut = Math.max(0, amountInNum - protocolFee);

      const effectiveRate = calculateEffectiveRate(
        amount,
        Math.floor(amountOut).toString(),
        route.source.decimals,
        route.destination.decimals
      );

      return [{
        source: route.source,
        destination: route.destination,
        amountIn: amount,
        amountOut: Math.floor(amountOut).toString(),
        effectiveRate,
        quotedAt: new Date().toISOString(),
      }];
    } catch (error) {
      console.error(`[Wormhole] Failed to get rate:`, error);
      return [];
    }
  }

  async getLiquidityDepth(
    route: RouteType<WormholeAssetType>
  ): Promise<LiquidityDepthType<WormholeAssetType>[]> {
    try {
      const governorLimits = await this.client.fetchGovernorLimits();
      const limitsMap = new Map<string, typeof governorLimits[0]>();
      
      for (const limit of governorLimits) {
        limitsMap.set(limit.chainId.toString(), limit);
      }

      const sourceChainLimit = limitsMap.get(route.source.chainId);
      if (!sourceChainLimit) {
        return [];
      }

      const maxTransactionSize = parseFloat(sourceChainLimit.maxTransactionSize);
      const availableNotional = parseFloat(sourceChainLimit.availableNotional);
      const usableCapacity = Math.min(maxTransactionSize, availableNotional);

      return [{
        route,
        thresholds: [
          {
            maxAmountIn: Math.floor(usableCapacity * 0.5).toString(),
            slippageBps: 10,
          },
          {
            maxAmountIn: Math.floor(usableCapacity * 0.8).toString(),
            slippageBps: 50,
          },
          {
            maxAmountIn: Math.floor(usableCapacity).toString(),
            slippageBps: 100,
          }
        ],
        measuredAt: new Date().toISOString(),
      }];
    } catch (error) {
      console.error("[Wormhole] Failed to fetch liquidity:", error);
      return [];
    }
  }
}
