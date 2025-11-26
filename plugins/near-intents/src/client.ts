import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import type { QuoteRequest, QuoteResponse, TokenResponse } from '@defuse-protocol/one-click-sdk-typescript';
import { z } from 'every-plugin/zod';

export const IntentsAsset = z.object({
  blockchain: z.string(),            // NEAR Intents blockchain enum
  intentsAssetId: z.string(),       // 1Click / NEAR Intents provider-specific asset ID
  symbol: z.string(),              // Token symbol
  decimals: z.number(),            // Token decimals
  contractAddress: z.string().optional(), // Contract address
  price: z.number().optional(),           // USD price (from 1Click)
  priceUpdatedAt: z.string().optional(),  // Price timestamp
});

export type IntentsAssetType = z.infer<typeof IntentsAsset>;


/**
 * DefiLlama DEX Volume Summary Response for NEAR Intents
 * From https://api.llama.fi/summary/dexs/near-intents
 */
export interface DefiLlamaNearIntentsDexSummary {
  protocol?: string; // "near-intents"
  total24h?: number;
  total48hto24h?: number;
  total7d?: number;
  total30d?: number;
  totalAllTime?: number;
}

/**
 * HTTP Client Layer for NEAR Intents Data Provider APIs
 *
 * This layer handles external HTTP communication with two APIs:
 * - 1Click API (https://1click.chaindefuser.com)
 * - Intents Explorer API (https://explorer.near-intents.org)
 *
 * Key responsibilities:
 * - Rate limiting to respect both API limits
 * - Automatic retries for transient failures
 * - Timeout handling for slow responses
 * - Consistent error handling and logging
 * - API key handling (JWT for both APIs, optional)
 */

/**
 * Response types from Intents Explorer API
 * These are customized based on the actual Explorer API responses.
 */
export interface ExplorerTransaction {
  originAsset: string;
  destinationAsset: string;
  status: 'SUCCESS' | 'FAILED' | 'INCOMPLETE_DEPOSIT' | 'PENDING_DEPOSIT' | 'PROCESSING' | 'REFUNDED';
  amountInUsd: string;
  amountOutUsd: string;
}

export interface ExplorerTransactionsPageResponse {
  data: ExplorerTransaction[];
  totalPages: number;
  page: number;
  perPage: number;
  total: number;
  nextPage: number | null;
  prevPage: number | null;
}

/**
 * Response types from 1Click API
 * Uses SDK types where possible, custom for our specific needs
 */
export interface OneClickTokensResponse {
  assets: TokenResponse[];
  measuredAt: string;
}

/**
 * HTTP client that wraps both 1Click and Explorer APIs.
 * Handles all HTTP communication with retry logic, rate limiting, and error handling.
 */
export class IntentsClient {
  private readonly oneClickHttp: HttpClient;
  private readonly explorerHttp: HttpClient;
  private readonly llamaHttp: HttpClient;

  constructor(
    private readonly oneClickBaseUrl: string,
    private readonly explorerBaseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly timeout: number = 30000
  ) {
    // Create HTTP headers with optional JWT
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 1Click client with rate limiting
    this.oneClickHttp = createHttpClient({
      baseUrl: oneClickBaseUrl,
      headers,
      rateLimiter: createRateLimiter(5), // 5 req/sec for 1Click
      timeout,
      retries: 3
    });

    // Explorer client (same headers, rate limiting)
    this.explorerHttp = createHttpClient({
      baseUrl: explorerBaseUrl,
      headers,
      rateLimiter: createRateLimiter(2), // 2 req/sec for Explorer
      timeout,
      retries: 2 // Fewer retries for Explorer
    });

    // DefiLlama client for DEX volume data
    this.llamaHttp = createHttpClient({
      baseUrl: "https://api.llama.fi",
      rateLimiter: createRateLimiter(5), // 5 req/sec for DefiLlama
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch supported tokens from 1Click API.
   */
  async fetchTokens(): Promise<TokenResponse[]> {
    return this.oneClickHttp.get<TokenResponse[]>('/v0/tokens');
  }

  /**
   * Fetch quote from 1Click API using SDK request/response types.
   */
  async fetchQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.oneClickHttp.post<QuoteResponse>('/v0/quote', request);
  }

  /**
   * Fetch paginated transactions from Intents Explorer API.
   */
  async fetchTransactionsPage(params: {
    page?: number;
    perPage?: number;
    toTokenId?: string;
    startTimestamp?: number;
    statuses?: string;
    search?: string;
  }): Promise<ExplorerTransactionsPageResponse> {
    return this.explorerHttp.get<ExplorerTransactionsPageResponse>('/api/v0/transactions-pages', {
      params: {
        perPage: 1000, // Max per page
        page: 1, // Start from page 1
        ...params
      }
    });
  }

  /**
   * Fetch DEX volume summary from DefiLlama for NEAR Intents.
   */
  async fetchDexSummary(): Promise<DefiLlamaNearIntentsDexSummary> {
    return this.llamaHttp.get<DefiLlamaNearIntentsDexSummary>('/summary/dexs/near-intents');
  }
}
