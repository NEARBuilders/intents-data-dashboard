import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * cBridge (Celer Network) API Client
 *
 * Handles all HTTP communication with cBridge APIs.
 */

/**
 * cBridge asset type for provider-specific format
 */
export const CBridgeAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type CBridgeAssetType = z.infer<typeof CBridgeAsset>;

/**
 * cBridge chain info
 */
export interface CBridgeChain {
  id: number;
  name: string;
  icon: string;
  block_delay: number;
  gas_token_symbol: string;
  explore_url: string;
  contract_addr: string;
}

/**
 * cBridge token info
 */
export interface CBridgeToken {
  token: {
    symbol: string;
    address: string;
    decimal: number;
    xfer_disabled: boolean;
  };
  name: string;
  icon: string;
}

/**
 * cBridge transfer configs response
 */
export interface CBridgeTransferConfigs {
  chains: CBridgeChain[];
  chain_token: Record<string, {
    token: CBridgeToken[];
  }>;
  farming_reward_contract_addr: string;
  pegged_pair_configs: Array<{
    org_chain_id: number;
    org_token: {
      token: {
        symbol: string;
        address: string;
        decimal: number;
      };
    };
    pegged_chain_id: number;
    pegged_token: {
      token: {
        symbol: string;
        address: string;
        decimal: number;
      };
    };
  }>;
}

/**
 * cBridge estimate amount response
 */
export interface CBridgeEstimateResponse {
  err: {
    code: number;
    msg: string;
  } | null;
  estimated_receive_amt: string;
  base_fee: string;
  perc_fee: string;
  bridge_rate: number;
}

/**
 * HTTP client for cBridge Protocol APIs
 */
export class CBridgeApiClient {
  private readonly cbridgeHttp: HttpClient;

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.cbridgeHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(10),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch transfer configs (chains and tokens) from cBridge API
   */
  async fetchTransferConfigs(): Promise<CBridgeTransferConfigs> {
    return this.cbridgeHttp.get<CBridgeTransferConfigs>('/v2/getTransferConfigsForAll');
  }

  /**
   * Fetch estimate amount from cBridge API
   */
  async fetchEstimateAmount(params: {
    src_chain_id: number;
    dst_chain_id: number;
    token_symbol: string;
    amt: string;
    usr_addr: string;
    slippage_tolerance: number;
  }): Promise<CBridgeEstimateResponse> {
    return this.cbridgeHttp.get<CBridgeEstimateResponse>('/v2/estimateAmt', { params });
  }
}
