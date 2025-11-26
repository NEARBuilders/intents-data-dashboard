import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, calculateEffectiveRate, canonicalToAsset, getChainIdFromBlockchain } from '@data-provider/plugin-utils';
import { AxelarApiClient, AxelarAssetInfo, AxelarAssetType, AxelarChain } from './client';

import type {
  AssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * Data Provider Service for Axelar
 *
 * Axelar is a universal interoperability platform.
 *
 * Key features:
 * - Chain name system (not chainId)
 * - Dynamic asset loading from Axelarscan
 * - Transfer volume metrics from Axelarscan
 * - Fee estimation ~0.1%
 */
export class AxelarService extends BaseDataProviderService<AxelarAssetType> {
  private chains: AxelarChain[] | null = null;
  private assets: AxelarAssetInfo[] | null = null;

  constructor(
    private readonly client: AxelarApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<AxelarAssetType> {
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
  async transformAssetFromProvider(asset: AxelarAssetType): Promise<AssetType> {
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
   * Fetch volume metrics from Axelarscan API.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    const volumes: VolumeWindowType[] = [];
    const now = Math.floor(Date.now() / 1000);

    const windowDurations: Record<string, number> = {
      "24h": 24 * 60 * 60,
      "7d": 7 * 24 * 60 * 60,
      "30d": 30 * 24 * 60 * 60,
    };

    for (const window of windows) {
      try {
        const duration = windowDurations[window];
        if (!duration) {
          console.warn(`[Axelar] Unknown window: ${window}`);
          continue;
        }

        const fromTimestamp = now - duration;
        const transfers = await this.client.fetchTransferVolumes({
          from: fromTimestamp,
          to: now
        });

        let totalVolume = 0;
        for (const transfer of transfers) {
          totalVolume += transfer.volume || 0;
        }

        volumes.push({
          window,
          volumeUsd: totalVolume,
          measuredAt: new Date().toISOString(),
        });

        console.log(`[Axelar] Volume ${window}: $${totalVolume.toLocaleString()}`);
      } catch (error) {
        console.error(`[Axelar] Failed to fetch volume for window ${window}:`, error);
        volumes.push({
          window,
          volumeUsd: 0,
          measuredAt: new Date().toISOString()
        });
      }
    }

    return volumes;
  }

  /**
   * Fetch list of assets supported by Axelar.
   */
  async getListedAssets(): Promise<AxelarAssetType[]> {
    try {
      await this.ensureMetadataLoaded();

      if (!this.assets || !this.chains) {
        console.error("[Axelar] Metadata not available");
        return [];
      }

      const assetsList: AxelarAssetType[] = [];

      for (const asset of this.assets) {
        if (!asset.addresses || typeof asset.addresses !== 'object') {
          continue;
        }

        for (const [chainName, addressInfo] of Object.entries(asset.addresses)) {
          if (!addressInfo?.address) {
            continue;
          }

          const chainId = this.getChainIdByName(chainName);
          if (!chainId) {
            continue;
          }

          assetsList.push({
            chainId,
            address: addressInfo.address,
            symbol: addressInfo.symbol || asset.symbol,
            decimals: addressInfo.decimals || 18
          });
        }
      }

      console.log(`[Axelar] Loaded ${assetsList.length} assets from API`);
      return assetsList;
    } catch (error) {
      console.error("[Axelar] Failed to fetch assets from API:", error);
      return [];
    }
  }

  /**
   * Fetch rate quotes.
   */
  async getRates(
    route: RouteType<AxelarAssetType>,
    amount: string
  ): Promise<RateType<AxelarAssetType>[]> {
    console.log(`[Axelar] No public rate API available for ${route.source.symbol} -> ${route.destination.symbol}`);
    return [];
  }

  /**
   * Fetch liquidity depth.
   */
  async getLiquidityDepth(
    route: RouteType<AxelarAssetType>
  ): Promise<LiquidityDepthType<AxelarAssetType>[]> {
    console.log(`[Axelar] No public liquidity API available for route ${route.source.symbol} -> ${route.destination.symbol}`);
    return [];
  }

  /**
   * Ensure chains and assets metadata is loaded.
   */
  private async ensureMetadataLoaded(): Promise<void> {
    if (!this.chains) {
      this.chains = await this.client.fetchChains();
    }
    if (!this.assets) {
      this.assets = await this.client.fetchAssets();
    }
  }

  /**
   * Get chain ID from chain name.
   */
  private getChainIdByName(chainName: string): string | null {
    if (!this.chains) return null;

    const chain = this.chains.find(c =>
      c.name.toLowerCase() === chainName.toLowerCase() ||
      c.chain_name?.toLowerCase() === chainName.toLowerCase()
    );

    if (!chain?.id) return null;

    const chainIdMap: Record<string, string> = {
      "ethereum": "1",
      "avalanche": "43114",
      "polygon": "137",
      "fantom": "250",
      "moonbeam": "1284",
      "arbitrum": "42161",
      "optimism": "10",
      "base": "8453",
      "binance": "56",
      "celo": "42220",
      "kava": "2222",
      "filecoin": "314",
      "linea": "59144",
      "mantle": "5000",
      "scroll": "534352",
    };

    return chainIdMap[chain.id.toLowerCase()] || null;
  }
}
