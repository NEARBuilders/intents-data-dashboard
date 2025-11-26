import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

export const DeBridgeAsset = z.object({
  chainId: z.string(),
  address: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional()
});

export type DeBridgeAssetType = z.infer<typeof DeBridgeAsset>;

interface DeBridgeQuoteEstimation {
  srcChainTokenIn: {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    amount: string;
    approximateOperatingExpense?: string;
    mutatedWithOperatingExpense?: boolean;
    approximateUsdValue?: number;
    originApproximateUsdValue?: number;
  };
  srcChainTokenOut?: {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    amount: string;
    maxRefundAmount?: string;
    approximateUsdValue?: number;
  };
  dstChainTokenOut: {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    amount: string;
    recommendedAmount?: string;
    maxTheoreticalAmount?: string;
    approximateUsdValue?: number;
    recommendedApproximateUsdValue?: number;
    maxTheoreticalApproximateUsdValue?: number;
  };
  costsDetails: Array<{
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    type: string;
    payload?: {
      feeAmount?: string;
      feeBps?: string;
      estimatedVolatilityBps?: string;
      feeApproximateUsdValue?: string;
    };
  }>;
  recommendedSlippage?: number;
}

export interface DeBridgeQuote {
  estimation: DeBridgeQuoteEstimation;
  tx?: {
    to: string;
    data: string;
    value: string;
  };
  prependedOperatingExpenseCost?: string;
  order?: {
    approximateFulfillmentDelay: number;
    salt: number;
    metadata: string;
  };
  orderId: string;
  fixFee?: string;
  protocolFee?: string;
  userPoints?: number;
  integratorPoints?: number;
  estimatedTransactionFee?: {
    total: string;
    details: {
      gasLimit: string;
      baseFee: string;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
  };
  protocolFeeApproximateUsdValue?: number;
  usdPriceImpact?: number;
}

interface DeBridgeTokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

export interface DeBridgeChainsInfo {
  [chainId: string]: {
    tokens?: {
      [address: string]: DeBridgeTokenInfo;
    };
    [key: string]: any;
  };
}

export interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

export interface DeBridgeQuoteRequest {
  srcChainId: number;
  srcChainTokenIn: string;
  srcChainTokenInAmount: string;
  dstChainId: number;
  dstChainTokenOut: string;
  dstChainTokenOutAmount: string;
  dstChainTokenOutRecipient?: string;
  dstChainOrderAuthorityAddress?: string;
  srcChainOrderAuthorityAddress?: string;
  prependOperatingExpenses?: string;
}

export class DeBridgeApiClient {
  private readonly dlnHttp: HttpClient;
  private readonly defillamaHttp: HttpClient;
  private readonly DEBRIDGE_BRIDGE_ID = "20";

  constructor(
    dlnBaseUrl: string,
    defillamaBaseUrl: string,
    private readonly apiKey: string,
    timeout: number = 30000,
    maxRequestsPerSecond: number = 10
  ) {
    this.dlnHttp = createHttpClient({
      baseUrl: dlnBaseUrl,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: defillamaBaseUrl,
      rateLimiter: createRateLimiter(100),
      timeout,
      retries: 3
    });
  }

  async fetchQuote(request: DeBridgeQuoteRequest): Promise<DeBridgeQuote> {
    const headers = this.apiKey && this.apiKey !== 'not-required'
      ? { 'Authorization': `Bearer ${this.apiKey}` }
      : {};

    return this.dlnHttp.post<DeBridgeQuote>('/v1.0/dln/order/quote', {
      body: request,
      headers
    });
  }

  async fetchSupportedChains(): Promise<DeBridgeChainsInfo> {
    return this.dlnHttp.get<DeBridgeChainsInfo>('/v1.0/supported-chains-info');
  }

  async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse> {
    return this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.DEBRIDGE_BRIDGE_ID}`);
  }
}
