import { createHttpClient, createRateLimiter, type HttpClient } from '@data-provider/plugin-utils';
import { z } from 'every-plugin/zod';

/**
 * CCTP (Circle Cross-Chain Transfer Protocol) API Client
 *
 * Handles all HTTP communication with Circle CCTP APIs:
 * - Circle Iris API: Fees, allowances
 * - DefiLlama API: Volume metrics
 */

/**
 * CCTP asset type for provider-specific format
 */
export const CCTPAsset = z.object({
  chainId: z.string(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export type CCTPAssetType = z.infer<typeof CCTPAsset>;

/**
 * CCTP fee response
 */
export interface CCTPFeeResponseWrapper {
  data: Array<{
    finalityThreshold: number;
    minimumFee: number;
  }>;
}

export type CCTPFeeResponse = Array<{
  finalityThreshold: number;
  minimumFee: number;
}>;

/**
 * CCTP allowance response
 */
export interface CCTPAllowanceResponse {
  allowance: number;
  lastUpdated: string;
}

/**
 * DefiLlama Bridge Stats Response
 */
export interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  lastWeeklyVolume: number;
  lastMonthlyVolume: number;
  currentDayVolume: number;
  dayBeforeLastVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * HTTP client for CCTP APIs
 */
export class CCTPApiClient {
  private readonly irisHttp: HttpClient;
  private readonly defillamaHttp: HttpClient;
  private readonly CCTP_BRIDGE_ID = "51";

  constructor(
    private readonly baseUrl: string,
    private readonly timeout: number = 30000
  ) {
    this.irisHttp = createHttpClient({
      baseUrl,
      rateLimiter: createRateLimiter(35),
      timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: "https://bridges.llama.fi",
      rateLimiter: createRateLimiter(100),
      timeout,
      retries: 3
    });
  }

  /**
   * Fetch fees from Circle Iris API
   */
  async fetchFees(sourceDomain: number, destDomain: number): Promise<CCTPFeeResponse> {
    const payload = await this.irisHttp.get<CCTPFeeResponseWrapper | CCTPFeeResponse>(
      `/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`
    );
    
    const data: CCTPFeeResponse | undefined = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as CCTPFeeResponseWrapper | undefined)?.data)
        ? (payload as CCTPFeeResponseWrapper).data
        : undefined;

    if (!data || data.length === 0) {
      throw new Error("CCTP fees endpoint returned an empty or invalid payload");
    }

    return data;
  }

  /**
   * Fetch Fast Transfer Allowance from Circle Iris API
   */
  async fetchAllowance(): Promise<CCTPAllowanceResponse> {
    const payload = await this.irisHttp.get<Partial<CCTPAllowanceResponse>>(`/v2/fastBurn/USDC/allowance`);
    
    const rawAllowance = payload?.allowance;
    const allowance =
      typeof rawAllowance === "number"
        ? rawAllowance
        : typeof rawAllowance === "string"
          ? Number.parseFloat(rawAllowance)
          : undefined;

    if (typeof allowance !== "number" || !Number.isFinite(allowance)) {
      throw new Error("CCTP allowance endpoint returned an invalid allowance value");
    }

    return {
      allowance,
      lastUpdated: typeof payload?.lastUpdated === "string" ? payload.lastUpdated : new Date().toISOString(),
    };
  }

  /**
   * Fetch volume data from DefiLlama Bridge API
   */
  async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse> {
    return this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.CCTP_BRIDGE_ID}`);
  }
}
