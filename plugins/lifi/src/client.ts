import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * Li.Fi Protocol API Client
 *
 * Handles all HTTP communication with Li.Fi APIs:
 * - Li.Fi API v1: Tokens, quotes, liquidity
 * - Li.Fi API v2: Analytics transfers for volumes
 */

/**
 * Li.Fi asset type for provider-specific format
 */
export const LiFiAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type LiFiAssetType = z.infer<typeof LiFiAsset>;

/**
 * Li.Fi token response
 */
export interface LiFiToken {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

/**
 * Li.Fi quote response
 */
export interface LiFiQuote {
  estimate: {
    fromAmount: string;
    toAmount: string;
    feeCosts: Array<{
      amount: string;
      amountUSD?: string;
    }>;
  };
}

/**
 * Li.Fi transfer response
 */
export interface LiFiTransfer {
  receiving: {
    amount: string;
    amountUSD?: string;
    token: {
      address: string;
      chainId: number;
      symbol: string;
    };
  };
  tool: string;
  status: string;
  timestamp: number;
}

/**
 * Li.Fi transfers response
 */
export interface LiFiTransfersResponse {
  data?: LiFiTransfer[];
  transfers?: LiFiTransfer[];
  hasNext?: boolean;
  next?: string;
}

/**
 * HTTP client for Li.Fi Protocol APIs
 */
export class LiFiApiClient {
  private readonly lifiHttp: HttpClient;
  private readonly analyticsHttp: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.lifiHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 1
    });

    this.analyticsHttp = createHttpClient({
      baseUrl: baseUrl.replace('/v1', '/v2'),
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 1
    });
  }

  /**
   * Fetch supported tokens from Li.Fi API
   */
  async fetchTokens(): Promise<{ tokens: Record<string, LiFiToken[]> }> {
    return this.lifiHttp.get<{ tokens: Record<string, LiFiToken[]> }>('/tokens');
  }

  /**
   * Fetch quote from Li.Fi API
   */
  async fetchQuote(params: {
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    slippage?: string;
  }): Promise<LiFiQuote> {
    return this.lifiHttp.get<LiFiQuote>('/quote', { params });
  }

  /**
   * Fetch transfers from Li.Fi analytics API
   */
  async fetchTransfers(params: {
    status: string;
    fromTimestamp: string;
    toTimestamp: string;
    limit: string;
    next?: string;
  }): Promise<LiFiTransfersResponse> {
    return this.analyticsHttp.get<LiFiTransfersResponse>('/analytics/transfers', { params });
  }
}
