import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * Wormhole Protocol API Client
 *
 * Handles all HTTP communication with Wormhole APIs:
 * - Wormholescan API: Token list, Governor limits
 * - DefiLlama API: Volume metrics
 *
 * Key responsibilities:
 * - Rate limiting to respect API limits
 * - Automatic retries for transient failures
 * - Timeout handling for slow responses
 * - Consistent error handling and logging
 */

/**
 * Wormhole asset type for provider-specific format
 */
export const WormholeAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type WormholeAssetType = z.infer<typeof WormholeAsset>;

/**
 * Wormhole token from token list API
 */
export interface WormholeToken {
  symbol: string;
  coingeckoId?: string;
  volume24h?: string;
  platforms: Record<string, string>;
}

/**
 * Governor Notional Limit API response
 */
export interface GovernorNotionalLimit {
  chainId: number;
  availableNotional: string;
  notionalLimit: string;
  maxTransactionSize: string;
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
 * HTTP client for Wormhole Protocol APIs
 */
export class WormholeApiClient {
  private readonly wormholeScanHttp: HttpClient;
  private readonly defillamaHttp: HttpClient;
  private readonly WORMHOLE_BRIDGE_ID = "77";

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.wormholeScanHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: "https://bridges.llama.fi",
      rateLimiter: createRateLimiter(5),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch supported tokens from Wormholescan API.
   */
  async fetchTokenList(): Promise<WormholeToken[]> {
    return this.wormholeScanHttp.get<WormholeToken[]>('/native-token-transfer/token-list');
  }

  /**
   * Fetch Governor notional limits from Wormholescan API.
   */
  async fetchGovernorLimits(): Promise<GovernorNotionalLimit[]> {
    return this.wormholeScanHttp.get<GovernorNotionalLimit[]>('/governor/notional/limit');
  }

  /**
   * Fetch volume data from DefiLlama Bridge API.
   */
  async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse> {
    return this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.WORMHOLE_BRIDGE_ID}`);
  }
}
