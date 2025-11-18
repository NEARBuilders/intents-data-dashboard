import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';

// cBridge API response types
export interface CBridgeChain {
  id: number;
  name: string;
  icon: string;
  gas_token_symbol: string;
  contract_addr: string;
}

export interface CBridgeToken {
  token: {
    symbol: string;
    address: string;
    decimal: number;
  };
  name: string;
  icon: string;
}

export interface CBridgeTransferConfigs {
  err: null | { msg: string };
  chains: CBridgeChain[];
  chain_token: Record<string, { token: CBridgeToken[] }>;
}

export interface CBridgeEstimateResponse {
  err: null | { msg: string };
  eq_value_token_amt: string;
  bridge_rate: number;
  perc_fee: string;
  base_fee: string;
  estimated_receive_amt: string;
  max_slippage?: number;
  slippage_tolerance?: number;
}

export interface CBridgeLatencyResponse {
  err: null | { msg: string };
  median_transfer_latency_in_second: number;
}

export interface CBridgeStatsResponse {
  totalTxVolume: string;
  last24HourTxVolume: string;
  totalTx: string;
  last24HourTx: string;
}

// DefiLlama API response types
export interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * cBridge API Client
 * Handles all HTTP communication with cBridge (Celer Network) APIs
 */
export class CBridgeApiClient {
  private readonly http: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeout: number = 30000
  ) {
    // cBridge currently has NO rate limiting, but we keep rate limiter for consistency
    this.http = createHttpClient({
      baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch supported chains and tokens
   */
  async fetchTransferConfigs(): Promise<CBridgeTransferConfigs> {
    return this.http.get<CBridgeTransferConfigs>('/v2/getTransferConfigsForAll');
  }

  /**
   * Fetch rate estimate for a transfer
   */
  async fetchEstimate(params: {
    src_chain_id: string;
    dst_chain_id: string;
    token_symbol: string;
    amt: string;
    usr_addr?: string;
    slippage_tolerance?: number;
  }): Promise<CBridgeEstimateResponse> {
    return this.http.get<CBridgeEstimateResponse>('/v2/estimateAmt', {
      params
    });
  }

  /**
   * Fetch transfer latency metrics
   */
  async fetchTransferLatency(params: {
    src_chain_id: string;
    dst_chain_id: string;
  }): Promise<CBridgeLatencyResponse> {
    return this.http.get<CBridgeLatencyResponse>('/v2/getLatest7DayTransferLatencyForQuery', {
      params
    });
  }
}

/**
 * DefiLlama API Client
 * Handles volume data from DefiLlama Bridge API
 */
export class DefiLlamaApiClient {
  private static readonly BASE_URL = 'https://bridges.llama.fi';

  private readonly http: HttpClient;

  constructor(private readonly timeout: number = 30000) {
    // DefiLlama supports higher rate limits
    this.http = createHttpClient({
      baseUrl: DefiLlamaApiClient.BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      rateLimiter: createRateLimiter(100), // High rate limit for DefiLlama
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch bridge volume data
   */
  async fetchBridgeVolume(bridgeId: string): Promise<DefiLlamaBridgeResponse> {
    return this.http.get<DefiLlamaBridgeResponse>(`/bridge/${bridgeId}`);
  }
}
