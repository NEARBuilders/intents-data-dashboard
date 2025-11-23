import { DataProviderService as BaseDataProviderService, getBlockchainFromChainId, getChainId, getChainNamespace } from "@data-provider/plugin-utils";
import { parse1cs, stringify1cs } from "@defuse-protocol/crosschain-assetid";
import type { AssetType } from "@data-provider/shared-contract";
import { ProviderApiClient, ProviderAssetType } from "./client";
import type {
  LiquidityDepthType,
  RateType,
  RouteType,
  TimeWindow,
  VolumeWindowType
} from "@data-provider/shared-contract";

/**
 * Service Layer for Data Provider Business Logic
 *
 * This layer implements core business logic for interacting with data provider APIs.
 * Key characteristics:
 * - Works exclusively in provider-specific format (ProviderAssetType)
 * - Each method maps directly to a provider API endpoint
 * - Returns data in provider format
 *
 * Architecture Flow:
 * 1. Router receives canonical asset IDs from client
 * 2. Router converts canonical → provider format
 * 3. Service queries provider API with provider format
 * 4. Service returns data in provider format
 * 5. Router converts provider → canonical format
 * 6. Router returns canonical asset IDs to client
 */
export class DataProviderService extends BaseDataProviderService<ProviderAssetType> {
  constructor(private readonly client: ProviderApiClient) {
    super();
  }

  /**
   * Transform canonical AssetType to provider-specific format.
   * Canonical 1cs_v1 → Provider (for middleware/requests)
   */
  async transformAssetToProvider(asset: AssetType): Promise<ProviderAssetType> {
    const parsed = parse1cs(asset.assetId);
    const chainId = await getChainId(parsed.chain);
    if (!chainId) {
      throw new Error(`Unsupported chain: ${parsed.chain}`);
    }
    return {
      chainId: chainId.toString(),
      address: parsed.reference
    };
  }

  /**
   * Transform provider-specific asset to canonical AssetType format.
   * Provider → Canonical 1cs_v1 (for responses)
   */
  async transformAssetFromProvider(asset: ProviderAssetType): Promise<AssetType> {
    const blockchain = await getBlockchainFromChainId(asset.chainId);

    if (!blockchain) {
      switch (asset.chainId) {
        default: {
          throw new Error(`Unknown chainId: ${asset.chainId} for asset ${asset.symbol} (${asset.address})`);
        }
      }
    }

    const { namespace, reference } = getChainNamespace(blockchain, asset.address);

    const assetId = stringify1cs({
      version: "v1",
      chain: blockchain,
      namespace,
      reference
    });

    return {
      assetId,
      symbol: asset.symbol!,
      decimals: asset.decimals!
    };
  }

  /**
   * Fetch volume metrics for specified time windows.
   */
  async getVolumes(windows: TimeWindow[]): Promise<VolumeWindowType[]> {
    const response = await this.client.fetchVolumes(windows);
    return response.volumes.map(volume => ({
      window: volume.window as TimeWindow,
      volumeUsd: volume.volumeUsd,
      measuredAt: volume.measuredAt
    }));
  }

  /**
   * Fetch list of assets supported by the provider.
   * Returns provider-specific asset format.
   */
  async getListedAssets(): Promise<ProviderAssetType[]> {
    const response = await this.client.fetchAssets();
    return response.assets.map(asset => ({
      chainId: asset.chainId,
      address: asset.address,
      symbol: asset.symbol,
      decimals: asset.decimals
    }));
  }

  /**
   * Fetch rate quotes for route/notional combinations.
   * Accepts provider-specific route format.
   * TODO: Implement provider's quote API endpoint
   */
  async getRates(route: RouteType<ProviderAssetType>, notionals: string[]): Promise<RateType<ProviderAssetType>[]> {
    return [];
  }

  /**
   * Fetch liquidity depth at 50bps and 100bps thresholds.
   * Accepts provider-specific route format.
   * TODO: Implement provider's liquidity API or simulate with quotes
   */
  async getLiquidityDepth(route: RouteType<ProviderAssetType>): Promise<LiquidityDepthType<ProviderAssetType>[]> {
    return [];
  }
}
