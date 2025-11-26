import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * Axelar Protocol API Client
 *
 * Handles all HTTP communication with Axelar APIs:
 * - Axelarscan API: Chains, assets, volumes, TVL
 */

/**
 * Axelar asset type for provider-specific format
 */
export const AxelarAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type AxelarAssetType = z.infer<typeof AxelarAsset>;

/**
 * Axelar chain response
 */
export interface AxelarChain {
  id: string;
  name: string;
  chain_name: string;
  chain_type: string;
  image: string;
}

/**
 * Axelar asset response
 */
export interface AxelarAssetInfo {
  id: string;
  denom: string;
  symbol: string;
  name: string;
  image: string;
  addresses: Record<string, {
    address: string;
    decimals: number;
    symbol: string;
  }>;
}

/**
 * Axelar transfer volume response
 */
export interface AxelarTransferVolume {
  key: string;
  num_txs: number;
  volume: number;
}

/**
 * HTTP client for Axelar Protocol APIs
 */
export class AxelarApiClient {
  private readonly axelarscanHttp: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.axelarscanHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch chains from Axelarscan API
   */
  async fetchChains(): Promise<AxelarChain[]> {
    return this.axelarscanHttp.get<AxelarChain[]>('/getChains');
  }

  /**
   * Fetch gateway assets from Axelarscan API
   */
  async fetchAssets(): Promise<AxelarAssetInfo[]> {
    return this.axelarscanHttp.get<AxelarAssetInfo[]>('/getAssets');
  }

  /**
   * Fetch transfer volumes from Axelarscan API
   */
  async fetchTransferVolumes(params: { from: number; to: number }): Promise<AxelarTransferVolume[]> {
    return this.axelarscanHttp.get<AxelarTransferVolume[]>('/token/transfersTotalVolume', { params });
  }
}
