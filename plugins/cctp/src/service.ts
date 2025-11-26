import { assetToCanonicalIdentity, DataProviderService as BaseDataProviderService, canonicalToAsset, getChainIdFromBlockchain } from '@data-provider/plugin-utils';
import { CCTPApiClient, CCTPAssetType, DefiLlamaBridgeResponse } from './client';

import type {
  AssetType,
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from '@data-provider/shared-contract';

/**
 * CCTP Domain configuration
 */
interface CCTPDomainInfo {
  name: string;
  chainId: string;
  domainId: number;
}

/**
 * Official CCTP domain mappings from Circle
 */
const CCTP_DOMAINS: Record<string, CCTPDomainInfo> = {
  "0": { name: "Ethereum", chainId: "1", domainId: 0 },
  "1": { name: "Avalanche", chainId: "43114", domainId: 1 },
  "2": { name: "Optimism", chainId: "10", domainId: 2 },
  "3": { name: "Arbitrum", chainId: "42161", domainId: 3 },
  "6": { name: "Base", chainId: "8453", domainId: 6 },
  "7": { name: "Polygon", chainId: "137", domainId: 7 },
};

/**
 * Official USDC contract addresses from Circle
 */
const USDC_ADDRESSES: Record<string, string> = {
  "1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  "10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

/**
 * Data Provider Service for CCTP
 *
 * CCTP is Circle's native burn-and-mint protocol for USDC cross-chain transfers.
 *
 * Key features:
 * - USDC-only transfers (native burn & mint, 1:1)
 * - Public API (no API key required)
 * - Fast Transfer (confirmed) vs Standard (finalized)
 * - Domain ID system
 */
export class CCTPService extends BaseDataProviderService<CCTPAssetType> {
  constructor(
    private readonly client: CCTPApiClient,
  ) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   */
  async transformAssetToProvider(asset: AssetType): Promise<CCTPAssetType> {
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
  async transformAssetFromProvider(asset: CCTPAssetType): Promise<AssetType> {
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
        console.warn("[CCTP] No volume data available from DefiLlama");
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
            volumeUsd = bridgeData.lastWeeklyVolume || 0;
            break;
          case "30d":
            volumeUsd = bridgeData.lastMonthlyVolume || 0;
            break;
          default:
            console.log(`[CCTP] Skipping unsupported volume window: ${window}`);
            continue;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now,
        });

        console.log(`[CCTP] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[CCTP] Failed to fetch volumes from DefiLlama:", error);
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch list of assets supported by CCTP (USDC only).
   */
  async getListedAssets(): Promise<CCTPAssetType[]> {
    const assets: CCTPAssetType[] = Object.entries(USDC_ADDRESSES).map(([chainId, address]) => ({
      chainId,
      address,
      symbol: "USDC",
      decimals: 6,
    }));

    console.log(`[CCTP] Listed ${assets.length} USDC assets across supported chains`);
    return assets;
  }

  /**
   * Fetch rate quotes for USDC transfers.
   */
  async getRates(
    route: RouteType<CCTPAssetType>,
    amount: string
  ): Promise<RateType<CCTPAssetType>[]> {
    const rates: RateType<CCTPAssetType>[] = [];

    if (route.source.symbol !== "USDC" || route.destination.symbol !== "USDC") {
      console.warn(`[CCTP] Non-USDC route: ${route.source.symbol} -> ${route.destination.symbol} (skipped)`);
      return rates;
    }

    const sourceDomain = this.getDomainFromChainId(route.source.chainId);
    const destDomain = this.getDomainFromChainId(route.destination.chainId);

    if (sourceDomain === null || destDomain === null) {
      console.warn(
        `[CCTP] Chain not found in official CCTP domains: ${route.source.chainId} -> ${route.destination.chainId}`
      );
      return rates;
    }

    try {
      const fees = await this.client.fetchFees(sourceDomain, destDomain);
      const amountInNum = parseFloat(amount);

      const standardFee = fees.find(f => f.finalityThreshold === 2000);
      const feeBps = standardFee?.minimumFee || 1;

      const feeUsd = (amountInNum * feeBps) / 10000;
      const amountOutNum = amountInNum - feeUsd;

      rates.push({
        source: route.source,
        destination: route.destination,
        amountIn: amount,
        amountOut: amountOutNum.toString(),
        effectiveRate: amountOutNum / amountInNum,
        quotedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[CCTP] Failed to calculate rate for ${route.source.symbol}:`, error);
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using Fast Transfer Allowance.
   */
  async getLiquidityDepth(
    route: RouteType<CCTPAssetType>
  ): Promise<LiquidityDepthType<CCTPAssetType>[]> {
    try {
      const allowance = await this.client.fetchAllowance();
      
      if (!allowance) {
        console.warn("[CCTP] Allowance unavailable");
        return [];
      }

      const allowanceUsd = Number(allowance.allowance);
      if (!Number.isFinite(allowanceUsd)) {
        console.warn("[CCTP] Allowance value is not finite");
        return [];
      }

      console.log(`[CCTP] Fast Transfer Allowance: $${allowanceUsd.toLocaleString()} USDC`);

      if (route.source.symbol !== "USDC" || route.destination.symbol !== "USDC") {
        return [];
      }

      return [{
        route,
        thresholds: [
          {
            maxAmountIn: allowanceUsd.toString(),
            slippageBps: 50,
          },
          {
            maxAmountIn: (allowanceUsd * 100).toString(),
            slippageBps: 100,
          }
        ],
        measuredAt: new Date().toISOString(),
      }];
    } catch (error) {
      console.error("[CCTP] Failed to fetch liquidity depth:", error);
      return [];
    }
  }

  /**
   * Get CCTP domain ID from chain ID.
   */
  private getDomainFromChainId(chainId: string): number | null {
    for (const [domainIdStr, info] of Object.entries(CCTP_DOMAINS)) {
      if (info.chainId === chainId) {
        return parseInt(domainIdStr, 10);
      }
    }
    console.warn(`[CCTP] Chain ID ${chainId} not found in official CCTP domains`);
    return null;
  }
}
