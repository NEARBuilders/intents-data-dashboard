import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * LayerZero/Stargate Protocol API Client
 *
 * Handles all HTTP communication with Stargate Finance APIs:
 * - Stargate Finance API: Chains, tokens, quotes
 * - DefiLlama API: Volume metrics
 */

/**
 * LayerZero asset type for provider-specific format
 */
export const LayerZeroAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type LayerZeroAssetType = z.infer<typeof LayerZeroAsset>;

/**
 * Stargate chain response
 */
export interface StargateChain {
  chainKey: string;
  chainType: string;
  chainId: number;
  shortName: string;
  name: string;
  nativeCurrency: {
    chainKey: string;
    name: string;
    symbol: string;
    decimals: number;
    address: string;
  };
}

/**
 * Stargate token response
 */
export interface StargateToken {
  isBridgeable: boolean;
  chainKey: string;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  price: {
    usd: number;
  };
}

/**
 * Stargate quote response
 */
export interface StargateQuote {
  route: string;
  error: string | null;
  srcAmount: string;
  dstAmount: string;
  srcAmountMax: string;
  dstAmountMin: string;
  srcToken: string;
  dstToken: string;
  srcAddress: string;
  dstAddress: string;
  srcChainKey: string;
  dstChainKey: string;
  fees: Array<{
    token: string;
    chainKey: string;
    amount: string;
    type: string;
  }>;
}

/**
 * DefiLlama Bridge Stats Response
 */
export interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * HTTP client for LayerZero/Stargate Protocol APIs
 */
export class LayerZeroApiClient {
  private readonly stargateHttp: HttpClient;
  private readonly defillamaHttp: HttpClient;
  private readonly LAYERZERO_BRIDGE_ID = "84";

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.stargateHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: "https://api.llama.fi",
      rateLimiter: createRateLimiter(5),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch chains from Stargate API
   */
  async fetchChains(): Promise<{ chains: StargateChain[] }> {
    return this.stargateHttp.get<{ chains: StargateChain[] }>('/chains');
  }

  /**
   * Fetch tokens from Stargate API
   */
  async fetchTokens(): Promise<{ tokens: StargateToken[] }> {
    return this.stargateHttp.get<{ tokens: StargateToken[] }>('/tokens');
  }

  /**
   * Fetch quote from Stargate API
   */
  async fetchQuote(params: {
    srcToken: string;
    dstToken: string;
    srcChainKey: string;
    dstChainKey: string;
    srcAmount: string;
    dstAmountMin: string;
    srcAddress: string;
    dstAddress: string;
  }): Promise<{ quotes: StargateQuote[] }> {
    return this.stargateHttp.get<{ quotes: StargateQuote[] }>('/quotes', { params });
  }

  /**
   * Fetch volume data from DefiLlama Bridge API
   */
  async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse> {
    return this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.LAYERZERO_BRIDGE_ID}`);
  }
}
