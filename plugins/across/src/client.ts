import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * Across Protocol API Client
 *
 * Handles all HTTP communication with Across Protocol APIs.
 * Key responsibilities:
 * - Rate limiting to respect API limits
 * - Automatic retries for transient failures
 * - Timeout handling for slow responses
 * - Consistent error handling and logging
 */

/**
 * Across asset type for provider-specific format
 */
export const AcrossAsset = z.object({
  chainId: z.number(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  name: z.string().optional(),
  logoUrl: z.string().optional(),
  priceUsd: z.string().optional(),
});

export type AcrossAssetType = z.infer<typeof AcrossAsset>;

/**
 * Available routes response from Across API
 */
export interface AcrossAvailableRoute {
  originChainId: number;
  originToken: string;
  destinationChainId: number;
  destinationToken: string;
  originTokenSymbol: string;
  destinationTokenSymbol: string;
  isNative: boolean;
}

/**
 * Suggested fees response from Across API
 */
export interface AcrossSuggestedFeesResponse {
  totalRelayFee: {
    pct: string;
    total: string;
  };
  relayerCapitalFee: {
    pct: string;
    total: string;
  };
  relayerGasFee: {
    pct: string;
    total: string;
  };
  lpFee: {
    pct: string;
    total: string;
  };
  timestamp: string;
  isAmountTooLow: boolean;
  quoteBlock: string;
  spokePoolAddress: string;
  exclusiveRelayer: string;
  exclusivityDeadline: string;
  expectedFillTimeSec: string;
  fillDeadline: string;
  limits: {
    minDeposit: string;
    maxDeposit: string;
    maxDepositInstant: string;
    maxDepositShortDelay: string;
    recommendedDepositInstant: string;
  };
}

/**
 * Deposit limits response from Across API
 */
export interface AcrossLimitsResponse {
  minDeposit: string;
  maxDeposit: string;
  maxDepositInstant: string;
  maxDepositShortDelay: string;
  recommendedDepositInstant: string;
}

/**
 * Swap approval response from Across API
 */
export interface AcrossApprovalResponse {
  inputAmount: string;
  expectedOutputAmount: string;
  minOutputAmount: string;
  expectedFillTime: number;
  fees: {
    total: {
      amount: string;
      pct: string;
    };
  };
}

/**
 * DefiLlama Bridge Stats Response
 */
export interface DefiLlamaBridgeResponse {
  id: number;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
  currentDayVolume: number;
  dayBeforeLastVolume: number;
}

/**
 * HTTP client for Across Protocol API
 */
export class AcrossApiClient {
  private readonly http: HttpClient;
  private readonly defillamaHttp: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.http = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10), // 10 requests per second
      timeout,
      retries: 3
    });

    // Separate client for DefiLlama
    this.defillamaHttp = createHttpClient({
      baseUrl: "https://bridges.llama.fi",
      rateLimiter: createRateLimiter(5), // Lower rate limit for DefiLlama
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch supported tokens from Across API.
   * Returns all supported tokens across chains.
   */
  async fetchTokens(): Promise<AcrossAssetType[]> {
    return this.http.get<AcrossAssetType[]>('/swap/tokens');
  }

  /**
   * Fetch suggested fees from Across API.
   */
  async fetchSuggestedFees(params: {
    inputToken: string;
    outputToken: string;
    originChainId: number;
    destinationChainId: number;
    amount: string;
  }): Promise<AcrossSuggestedFeesResponse> {
    return this.http.get<AcrossSuggestedFeesResponse>('/suggested-fees', {
      params: {
        inputToken: params.inputToken,
        outputToken: params.outputToken,
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        amount: params.amount,
      }
    });
  }

  /**
   * Fetch deposit limits from Across API.
   */
  async fetchLimits(params: {
    inputToken: string;
    outputToken: string;
    originChainId: number;
    destinationChainId: number;
  }): Promise<AcrossLimitsResponse> {
    return this.http.get<AcrossLimitsResponse>('/limits', {
      params: {
        inputToken: params.inputToken,
        outputToken: params.outputToken,
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
      }
    });
  }

  /**
   * Fetch swap approval from Across API.
   * Returns executable transaction data with expected output amounts.
   */
  async fetchApproval(params: {
    inputToken: string;
    outputToken: string;
    originChainId: number;
    destinationChainId: number;
    amount: string;
    depositor: string;
    recipient: string;
  }): Promise<AcrossApprovalResponse> {
    return this.http.get<AcrossApprovalResponse>('/swap/approval', {
      params: {
        tradeType: 'exactInput',
        inputToken: params.inputToken,
        outputToken: params.outputToken,
        originChainId: params.originChainId,
        destinationChainId: params.destinationChainId,
        amount: params.amount,
        depositor: params.depositor,
        recipient: params.recipient,
      }
    });
  }

  /**
   * Fetch volume data from DefiLlama Bridge API.
   */
  async fetchDefiLlamaVolumes(bridgeId: string): Promise<DefiLlamaBridgeResponse> {
    return this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${bridgeId}`);
  }
}
