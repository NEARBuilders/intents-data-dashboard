import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * HTTP Client Layer for Data Provider APIs
 *
 * This layer handles all external HTTP communication with data provider APIs.
 * Key responsibilities:
 * - Rate limiting to respect provider API limits
 * - Automatic retries for transient failures
 * - Timeout handling for slow responses
 * - Consistent error handling and logging
 *
 * The client works with provider-specific request/response formats.
 * Transformation to/from canonical 1cs_v1 format happens in the router layer.
 */

/**
 * API response types for the provider's endpoints.
 * These should be customized based on the actual provider's API responses.
 * The service layer (service.ts) maps these to standardized internal types.
 */
export interface VolumeResponse {
  volumes: Array<{
    window: string;
    volumeUsd: number;
    measuredAt: string;
  }>;
}

export const ProviderAsset = z.object({
  chainId: z.string(), // Standard chain ID (e.g., "1" for Ethereum, "137" for Polygon)
  address: z.string().optional(), // Contract address, undefined for native tokens
  symbol: z.string().optional(), // Token symbol (e.g., "ETH", "USDC") - optional when derived from canonical ID
  decimals: z.number().optional() // Token decimals for amount calculations - optional when derived from canonical ID
});

export type ProviderAssetType = z.infer<typeof ProviderAsset>;

export interface AssetsResponse {
  assets: Array<ProviderAssetType>;
  measuredAt: string;
}

export interface QuoteRequest {
  route: {
    source: ProviderAssetType;
    destination: ProviderAssetType;
  };
  amounts: string[];
}

export interface QuoteResponse {
  quotes: Array<{
    route: {
      source: ProviderAssetType;
      destination: ProviderAssetType;
    };
    amount: string;
    price: string;
    timestamp: string;
  }>;
}

export interface LiquidityRequest {
  route: {
    source: ProviderAssetType;
    destination: ProviderAssetType;
  };
}

export interface LiquidityResponse {
  liquidity: Array<{
    route: {
      source: ProviderAssetType;
      destination: ProviderAssetType;
    };
    depth50bps: string;
    depth100bps: string;
    timestamp: string;
  }>;
}

/**
 * HTTP client for the data provider's API.
 * Handles all HTTP communication with retry logic, rate limiting, and error handling.
 */
export class ProviderApiClient {
  private readonly http: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeout: number = 30000
  ) {
    this.http = createHttpClient({
      baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      rateLimiter: createRateLimiter(10), // 10 requests per second
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch volume data for specified time windows.
   */
  async fetchVolumes(windows: string[]): Promise<VolumeResponse> {
    return this.http.get<VolumeResponse>('/volumes', {
      params: { windows: windows.join(',') }
    });
  }

  /**
   * Fetch list of supported assets.
   */
  async fetchAssets(): Promise<AssetsResponse> {
    return this.http.get<AssetsResponse>('/assets');
  }

  /**
   * Fetch rate quotes for route/notional combinations.
   */
  async fetchQuotes(request: QuoteRequest): Promise<QuoteResponse> {
    return this.http.post<QuoteResponse>('/quotes', request);
  }

  /**
   * Fetch liquidity depth data for routes.
   */
  async fetchLiquidity(request: LiquidityRequest): Promise<LiquidityResponse> {
    return this.http.post<LiquidityResponse>('/liquidity', request);
  }

  /**
   * Health check endpoint.
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>('/health');
  }
}
