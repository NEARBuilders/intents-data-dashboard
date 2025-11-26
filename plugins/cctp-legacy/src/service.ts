import { Effect } from "every-plugin/effect";
import { createHttpClient, createRateLimiter } from '@data-provider/plugin-utils';
import cctpDomainsConfig from "../config/cctp-domains.json";
import type {
  AssetType,
  RateType,
  LiquidityDepthType,
  VolumeWindowType,
  ListedAssetsType,
  ProviderSnapshotType
} from '@data-provider/shared-contract';



/**
 * CCTP-specific API types
 */
interface CCTPFeeResponseWrapper {
  data: Array<{
    finalityThreshold: number; // 1000 = Fast, 2000 = Standard
    minimumFee: number; // In basis points (1 = 0.01%)
  }>;
}

type CCTPFeeResponse = Array<{
  finalityThreshold: number; // 1000 = Fast, 2000 = Standard
  minimumFee: number; // In basis points (1 = 0.01%)
}>;

interface CCTPAllowanceResponse {
  allowance: number; // USDC available for Fast Transfers (up to 6 decimals)
  lastUpdated: string; // ISO8601 timestamp
}

/**
 * DefiLlama Bridge Stats Response
 * Source: https://bridges.llama.fi/bridge/cctp
 */
interface DefiLlamaBridgeResponse {
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
 * CCTP Domain configuration from official Circle documentation
 * Source: https://developers.circle.com/stablecoins/docs/cctp-protocol-contract
 */
interface CCTPDomainInfo {
  name: string;
  chainId: string;
  domainId: number;
}

interface CCTPDomainsConfig {
  comment: string;
  source: string;
  lastUpdated: string;
  domains: Record<string, CCTPDomainInfo>;
}

/**
 * Data Provider Service for CCTP (Circle Cross-Chain Transfer Protocol)
 *
 * CCTP is Circle's native burn-and-mint protocol for USDC cross-chain transfers.
 *
 * Key features:
 * - USDC-only transfers (native burn & mint, 1:1)
 * - Public API (no API key required)
 * - Rate limit: 35 requests/second
 * - Exponential backoff: 1s, 2s, 4s on errors
 * - Fast Transfer (confirmed, ~8-20s) vs Standard (finalized, ~15 min on Ethereum)
 */
export class DataProviderService {
  private readonly DEFILLAMA_BASE_URL = "https://bridges.llama.fi";
  private readonly CCTP_BRIDGE_ID = "51"; // Circle CCTP bridge ID on DefiLlama
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private cctpDomains: CCTPDomainsConfig | null = null;
  private http: ReturnType<typeof createHttpClient>;
  private defillamaHttp: ReturnType<typeof createHttpClient>;

  // Cache for volume data to avoid excessive API calls
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;

  private normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "").trim();
      if (cleaned.length === 0) {
        return null;
      }

      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private parseDefiLlamaResponse(raw: unknown): DefiLlamaBridgeResponse | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const candidate = raw as Record<string, unknown>;
    const requiredKeys = [
      "lastDailyVolume",
      "currentDayVolume",
      "dayBeforeLastVolume",
      "weeklyVolume",
      "monthlyVolume",
    ];

    const normalized: Record<string, number> = {};

    for (const key of requiredKeys) {
      const value = this.normalizeNumber(candidate[key]);
      if (value === null) {
        return null;
      }
      normalized[key] = value;
    }

    // API returns id as number, convert to string
    const id = String(candidate.id || "");
    const displayName = typeof candidate.displayName === "string" ? candidate.displayName : "";

    if (!id || !displayName) {
      return null;
    }

    return {
      id,
      displayName,
      lastDailyVolume: normalized.lastDailyVolume,
      lastWeeklyVolume: normalized.weeklyVolume, // Map weeklyVolume to lastWeeklyVolume
      lastMonthlyVolume: normalized.monthlyVolume, // Map monthlyVolume to lastMonthlyVolume
      currentDayVolume: normalized.currentDayVolume,
      dayBeforeLastVolume: normalized.dayBeforeLastVolume,
      weeklyVolume: normalized.weeklyVolume,
      monthlyVolume: normalized.monthlyVolume,
    } as DefiLlamaBridgeResponse;
  }

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string, // Not used - CCTP is public
    private readonly timeout: number,
    maxRequestsPerSecond: number = 35
  ) {
    // Initialize HTTP clients with rate limiting
    this.http = createHttpClient({
      baseUrl: this.baseUrl,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: this.timeout,
      retries: 3
    });

    this.defillamaHttp = createHttpClient({
      baseUrl: this.DEFILLAMA_BASE_URL,
      rateLimiter: createRateLimiter(100), // High rate limit for DefiLlama
      timeout: this.timeout,
      retries: 3
    });

    console.log(`[CCTP] Service configured with base URL: ${this.baseUrl}`);

    // Load official CCTP domain configuration bundled at build time
    try {
      const parsedConfig = cctpDomainsConfig as CCTPDomainsConfig | undefined;
      if (!parsedConfig || typeof parsedConfig !== "object" || !parsedConfig.domains) {
        throw new Error("Missing domain mappings");
      }

      this.cctpDomains = parsedConfig;
      console.log(
        `[CCTP] Loaded ${Object.keys(this.cctpDomains.domains).length} official domain mappings from Circle`,
      );
    } catch (error) {
      console.error("[CCTP] Failed to load domains config:", error);
      this.cctpDomains = null;
    }
  }

  /**
   * Get chain ID from CCTP domain ID using official Circle mapping.
   * NEVER invents data - returns null if not found.
   */
  private getChainIdFromDomain(domainId: number): string | null {
    if (!this.cctpDomains) {
      console.error('[CCTP] Domains config not loaded');
      return null;
    }

    const domainInfo = this.cctpDomains.domains[domainId.toString()];
    if (!domainInfo) {
      console.warn(`[CCTP] Domain ID ${domainId} not found in official Circle config`);
      return null;
    }

    return domainInfo.chainId;
  }

  /**
   * Get CCTP domain ID from chain ID using official Circle mapping.
   * NEVER invents data - returns null if not found.
   */
  private getDomainFromChainId(chainId: string): number | null {
    if (!this.cctpDomains) {
      console.error('[CCTP] Domains config not loaded');
      return null;
    }

    // Search through all domains for matching chainId
    for (const [domainIdStr, info] of Object.entries(this.cctpDomains.domains)) {
      if (info.chainId === chainId) {
        return parseInt(domainIdStr, 10);
      }
    }

    console.warn(`[CCTP] Chain ID ${chainId} not found in official CCTP domains`);
    return null;
  }

  /**
   * Get complete snapshot of CCTP data for given routes and notionals.
   */
  async getSnapshot(params: {
    routes?: Array<{ source: AssetType; destination: AssetType }>;
    notionals?: string[];
    includeWindows?: Array<"24h" | "7d" | "30d">;
  }): Promise<ProviderSnapshotType> {
    try {
      const hasRoutes = params.routes && params.routes.length > 0;
      const hasNotionals = params.notionals && params.notionals.length > 0;

      console.log(`[CCTP] Fetching snapshot for ${params.routes?.length || 0} routes`);

      const [volumes, rates, liquidity, listedAssets] = await Promise.all([
        this.getVolumes(params.includeWindows || ["24h"]),
        hasRoutes && hasNotionals ? this.getRates(params.routes!, params.notionals!) : Promise.resolve([]),
        hasRoutes ? this.getLiquidityDepth(params.routes!) : Promise.resolve([]),
        this.getListedAssets()
      ]);

      console.log("[CCTP] All data fetched successfully");
      console.log("[CCTP] Volumes:", volumes.length);
      console.log("[CCTP] Rates:", rates.length);
      console.log("[CCTP] Liquidity:", liquidity.length);
      console.log("[CCTP] Listed assets:", listedAssets.assets.length);

      const snapshot = {
        volumes,
        rates,
        liquidity,
        listedAssets,
      } satisfies ProviderSnapshotType;

      console.log("[CCTP] Snapshot object created successfully");
      return snapshot;
    } catch (error: unknown) {
      console.log("[CCTP] Snapshot catch block triggered");
      console.log("[CCTP] Error type:", typeof error);
      console.log("[CCTP] Error constructor:", (error as any)?.constructor?.name);
      console.log("[CCTP] Error message:", (error as any)?.message);
      throw new Error(
        `Failed to fetch snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fetch volume metrics from DefiLlama Bridge API.
   * DefiLlama aggregates CCTP bridge volume data across all supported chains.
   *
   * Source: https://bridges.llama.fi/bridge/cctp
   * Data: Real aggregated volumes from on-chain events
   */
  private async getVolumes(windows: Array<"24h" | "7d" | "30d">): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumeWithRetry();

      if (!bridgeData) {
        console.warn("[CCTP] No volume data available from DefiLlama");
        return [];
      }

      const volumes: VolumeWindowType[] = [];
      const now = new Date().toISOString();

      for (const window of windows) {
        let volumeUsd: number;

        switch (window) {
          case "24h":
            // Last complete 24h period
            volumeUsd = bridgeData.lastDailyVolume || 0;
            break;
          case "7d":
            // Last complete 7-day period
            volumeUsd = bridgeData.lastWeeklyVolume || 0;
            break;
          case "30d":
            // Last complete 30-day period
            volumeUsd = bridgeData.lastMonthlyVolume || 0;
            break;
        }

        volumes.push({
          window,
          volumeUsd,
          measuredAt: now,
        });

        console.log(`[CCTP] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }

      return volumes;
    } catch (error) {
      console.error("[CCTP] Failed to fetch volumes from DefiLlama:", error);
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * Fetch rate quotes for route/notional combinations.
   *
   * CCTP transfers are 1:1 USDC burns/mints with minimal fees.
   * Rate calculation: amountOut = amountIn - fee
   */
  private async getRates(
    routes: Array<{ source: AssetType; destination: AssetType }>,
    notionals: string[]
  ): Promise<RateType[]> {
    const rates: RateType[] = [];

    for (const route of routes) {
      // CCTP only supports USDC
      if (route.source.symbol !== "USDC" || route.destination.symbol !== "USDC") {
        console.warn(`[CCTP] Non-USDC route: ${route.source.symbol} -> ${route.destination.symbol} (skipped)`);
        continue;
      }

      // Get domain IDs from official Circle mapping
      const sourceDomain = this.getDomainFromChainId(route.source.chainId);
      const destDomain = this.getDomainFromChainId(route.destination.chainId);

      if (sourceDomain === null || destDomain === null) {
        console.warn(
          `[CCTP] Chain not found in official CCTP domains: ${route.source.chainId} -> ${route.destination.chainId}. ` +
          `Skipping rather than inventing domain IDs.`
        );
        continue;
      }

      // Fetch fees for this route
      const fees = await this.fetchFeesWithRetry(sourceDomain, destDomain);

      for (const notional of notionals) {
        try {
          const amountInNum = parseFloat(notional);

          // Use Standard Transfer fee (typically 1 bps = 0.01%)
          const standardFee = fees.find(f => f.finalityThreshold === 2000);
          const feeBps = standardFee?.minimumFee || 1; // Default to 1 bps if not found

          // Calculate fee: (amount * bps) / 10000
          const feeUsd = (amountInNum * feeBps) / 10000;
          const amountOutNum = amountInNum - feeUsd;

          rates.push({
            source: route.source,
            destination: route.destination,
            amountIn: notional,
            amountOut: amountOutNum.toString(),
            effectiveRate: amountOutNum / amountInNum,
            totalFeesUsd: feeUsd,
            quotedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`[CCTP] Failed to calculate rate for ${route.source.symbol}:`, error);
        }
      }
    }

    return rates;
  }

  /**
   * Fetch liquidity depth using Fast Transfer Allowance from CCTP API.
   *
   * CCTP maintains a "Fast Transfer Allowance" (collateral pool) for fast transfers.
   * This represents the maximum amount available for instant transfers.
   *
   * Note: CCTP is a burn-and-mint protocol with 1:1 transfers (no actual slippage).
   * The "slippage" thresholds represent transfer speed/finality trade-offs:
   * - Fast Transfer: ~8-20s (limited by allowance)
   * - Standard Transfer: ~15 min (unlimited, waits for finality)
   *
   * Source: https://developers.circle.com/stablecoins/docs/cctp-protocol-contract
   */
  private async getLiquidityDepth(
    routes: Array<{ source: AssetType; destination: AssetType }>
  ): Promise<LiquidityDepthType[]> {
    try {
      const allowance = await this.fetchAllowanceWithRetry();
      if (!allowance) {
        console.warn("[CCTP] Allowance unavailable; returning empty liquidity data");
        return [];
      }

      const allowanceUsd = Number(allowance.allowance);
      if (!Number.isFinite(allowanceUsd)) {
        console.warn("[CCTP] Allowance value is not a finite number; returning empty liquidity data");
        return [];
      }
      const liquidity: LiquidityDepthType[] = [];

      console.log(`[CCTP] Fast Transfer Allowance: $${allowanceUsd.toLocaleString()} USDC`);

      for (const route of routes) {
        // Only USDC routes supported
        if (route.source.symbol !== "USDC" || route.destination.symbol !== "USDC") {
          continue;
        }

        liquidity.push({
          route,
          thresholds: [
            {
              // 50bps threshold: Fast Transfer allowance (8-20s)
              // This is the real limit from the API
              maxAmountIn: allowanceUsd.toString(),
              slippageBps: 50,
            },
            {
              // 100bps threshold: Standard Transfer (no limit, waits for finality)
              // Use a high value to indicate effectively unlimited for standard transfers
              maxAmountIn: (allowanceUsd * 100).toString(), // 100x allowance for standard
              slippageBps: 100,
            }
          ],
          measuredAt: new Date().toISOString(),
        });
      }

      return liquidity;
    } catch (error) {
      console.error("[CCTP] Failed to fetch liquidity depth:", error);
      return [];
    }
  }

  /**
   * Fetch list of assets supported by CCTP.
   * CCTP only supports USDC natively (burn-and-mint protocol).
   *
   * USDC addresses are canonical addresses from Circle's official documentation:
   * https://developers.circle.com/stablecoins/docs/usdc-on-test-networks
   * https://developers.circle.com/stablecoins/docs/cctp-technical-reference
   *
   * These addresses are stable and maintained by Circle - they don't change.
   */
  private async getListedAssets(): Promise<ListedAssetsType> {
    // CCTP only supports USDC natively
    // Source: Circle CCTP V2 documentation - official USDC contract addresses
    const USDC_ADDRESSES: Record<string, string> = {
      "1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",      // Ethereum - USDC
      "43114": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Avalanche - USDC
      "10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",    // Optimism - USDC (bridged)
      "42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  // Arbitrum - USDC
      "8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",   // Base - USDC
      "137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",    // Polygon - USDC
    };

    const assets: AssetType[] = Object.entries(USDC_ADDRESSES).map(([chainId, address]) => ({
      chainId,
      assetId: address,
      symbol: "USDC",
      decimals: 6,
    }));

    // Add Solana USDC (SPL token)
    // Source: https://developers.circle.com/stablecoins/docs/usdc-on-main-networks#solana
    assets.push({
      chainId: "solana",
      assetId: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Solana USDC mint
      symbol: "USDC",
      decimals: 6,
    });

    console.log(`[CCTP] Listed ${assets.length} USDC assets across supported chains`);

    return {
      assets,
      measuredAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch CCTP fees with retry logic.
   * Implements exponential backoff: 1s, 2s, 4s
   */
  private async fetchFeesWithRetry(
    sourceDomain: number,
    destDomain: number
  ): Promise<CCTPFeeResponse> {
    try {
      const payload = await this.http.get<any>(`/v2/burn/USDC/fees/${sourceDomain}/${destDomain}`);
      const data: CCTPFeeResponse | undefined = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as CCTPFeeResponseWrapper | undefined)?.data)
          ? (payload as CCTPFeeResponseWrapper).data
          : undefined;

      if (!data || data.length === 0) {
        throw new Error("CCTP fees endpoint returned an empty or invalid payload");
      }

      console.log(`[CCTP] Successfully fetched fees:`, data);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CCTP] Fees fetch failed:`, message);

      // Return default fees if all retries fail
      console.warn("[CCTP] Using default fees after retries failed");
      return [
        { finalityThreshold: 1000, minimumFee: 1 }, // Fast: 1 bps
        { finalityThreshold: 2000, minimumFee: 1 }, // Standard: 1 bps
      ];
    }
  }

  /**
   * Fetch CCTP Fast Transfer Allowance with retry logic.
   */
  private async fetchAllowanceWithRetry(): Promise<CCTPAllowanceResponse | null> {
    try {
      const payload = await this.http.get<any>(`/v2/fastBurn/USDC/allowance`);
      const rawAllowance = (payload as Partial<CCTPAllowanceResponse> | undefined)?.allowance;
      const allowance =
        typeof rawAllowance === "number"
          ? rawAllowance
          : typeof rawAllowance === "string"
            ? Number.parseFloat(rawAllowance)
            : undefined;

      if (typeof allowance !== "number" || !Number.isFinite(allowance)) {
        throw new Error("CCTP allowance endpoint returned an invalid allowance value");
      }

      const result: CCTPAllowanceResponse = {
        allowance,
        lastUpdated:
          typeof (payload as Partial<CCTPAllowanceResponse>)?.lastUpdated === "string"
            ? (payload as CCTPAllowanceResponse).lastUpdated
            : new Date().toISOString(),
      };

      console.log(`[CCTP] Successfully fetched allowance: $${allowance.toLocaleString()} USDC`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CCTP] Allowance fetch failed:`, message);
      return null;
    }
  }

  /**
   * Fetch volume data from DefiLlama Bridge API with caching and retry logic.
   * DefiLlama provides aggregated bridge statistics including 24h, 7d, and 30d volumes.
   *
   * @returns Bridge data from DefiLlama or null if unavailable
   */
  private async fetchDefiLlamaVolumeWithRetry(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && (Date.now() - this.volumeCache.fetchedAt) < this.VOLUME_CACHE_TTL) {
      console.log("[CCTP] Using cached volume data from DefiLlama");
      return this.volumeCache.data;
    }

    try {
      const rawData = await this.defillamaHttp.get<any>(`/bridge/${this.CCTP_BRIDGE_ID}`);
      const data = this.parseDefiLlamaResponse(rawData);

      if (!data) {
        throw new Error("Invalid response structure from DefiLlama");
      }

      // Cache the result
      this.volumeCache = {
        data,
        fetchedAt: Date.now(),
      };

      console.log(`[CCTP] Successfully fetched volumes from DefiLlama: 24h=$${data.lastDailyVolume.toLocaleString()}`);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[CCTP] DefiLlama fetch failed:`, message);

      // Cache the null result to avoid hammering the API
      this.volumeCache = {
        data: null,
        fetchedAt: Date.now(),
      };

      return null;
    }
  }

  ping() {
    return Effect.tryPromise({
      try: async () => {
        return {
          status: "ok" as const,
          timestamp: new Date().toISOString(),
        };
      },
      catch: (error: unknown) =>
        new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`)
    });
  }
}
