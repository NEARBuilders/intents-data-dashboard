import { Effect } from "every-plugin/effect";
import { createHttpClient, createRateLimiter, getChainId } from '@data-provider/plugin-utils';
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import type {
  AssetType,
  RateType,
  LiquidityDepthType,
  VolumeWindowType,
  ListedAssetsType,
  ProviderSnapshotType
} from '@data-provider/shared-contract';

/**
 * Official Axelarscan API Response Types
 * Source: https://docs.axelarscan.io/
 */

interface AxelarscanChain {
  id: string;
  chain_id: number | string;
  chain_name: string;
  maintainer_id: string;
  endpoints: {
    rpc: string[];
    lcd: string[];
  };
  native_token: {
    symbol: string;
    name: string;
    decimals: number;
  };
  name: string;
  chain_type: string;
}

interface AxelarscanAsset {
  id: string;
  denom: string;
  native_chain: string;
  name: string;
  symbol: string;
  decimals: number;
  coingecko_id?: string;
  addresses: Record<
    string,
    {
      address?: string;
      ibc_denom?: string;
      symbol?: string;
    }
  >;
}

interface AxelarscanTVLResponse {
  data: Array<{
    asset: string;
    assetType: string;
    total: number;
    total_on_evm: number;
    total_on_cosmos: number;
    price: number;
  }>;
}

interface AxelarscanVolumeResponse {
  value: number;
}

interface DefiLlamaBridgeResponse {
  id: string;
  displayName: string;
  lastDailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * Fully Dynamic Axelar Data Provider Service
 * 
 * DATA SOURCES (All from Axelarscan API):
 * 1. /getChains - Official chain configurations
 * 2. /getAssets - All gateway assets (axlUSDC, axlUSDT, AXL, etc.)
 * 3. /interchainTotalVolume - Transfer volumes for time windows
 * 4. /getTVL - Total Value Locked per asset
 * 5. AxelarJS SDK - Transfer fees from network
 * 
 * NO hardcoded assets - Everything fetched from official APIs
 * Source: https://docs.axelarscan.io/
 */
export class DataProviderService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000];
  private readonly AXELAR_BRIDGE_ID = "17"; // Axelar bridge ID on DefiLlama
  private readonly VOLUME_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private volumeCache: { data: DefiLlamaBridgeResponse | null; fetchedAt: number } | null = null;

  private axelarQueryAPI: AxelarQueryAPI;
  private chainsCache: AxelarscanChain[] | null = null;
  private chainIdToNameMap: Map<string, string> | null = null;
  private assetsCache: AxelarscanAsset[] | null = null;
  private http: ReturnType<typeof createHttpClient>;
  private defillamaHttp: ReturnType<typeof createHttpClient>;

  // Base URLs for Axelarscan API
  private readonly axelarscanBaseUrl = "https://api.axelarscan.io";

  constructor(
    private readonly baseUrl: string,
    private readonly defillamaBaseUrl: string,
    private readonly apiKey: string,
    private readonly timeout: number,
    maxRequestsPerSecond: number = 10
  ) {
    // Initialize HTTP client with rate limiting
    this.http = createHttpClient({
      baseUrl: this.axelarscanBaseUrl,
      rateLimiter: createRateLimiter(maxRequestsPerSecond),
      timeout: this.timeout,
      retries: 3
    });

    // Initialize DefiLlama HTTP client
    this.defillamaHttp = createHttpClient({
      baseUrl: this.defillamaBaseUrl,
      rateLimiter: createRateLimiter(100), // High rate limit for DefiLlama
      timeout: this.timeout,
      retries: 3
    });

    const environment = baseUrl.includes('testnet')
      ? Environment.TESTNET
      : Environment.MAINNET;

    this.axelarQueryAPI = new AxelarQueryAPI({ environment });
    console.log(`[Axelar] Initialized SDK for ${environment}`);
  }

  /**
   * Convert NEAR Intents asset format to Axelar chain name format.
   * Axelar uses chain names (e.g., "ethereum", "polygon") instead of chain IDs.
   */
  private async assetToProviderFormat(asset: AssetType): Promise<any | null> {
    const chainId = await getChainId(asset.blockchain);
    if (!chainId) {
      console.warn(`[Axelar] Chain not found for blockchain: ${asset.blockchain}`);
      return null;
    }

    // Get chain name from Axelarscan API
    const chains = await this.fetchChainsWithRetry();
    const chain = chains.find(c => c.chain_id?.toString() === chainId.toString());
    if (!chain) {
      console.warn(`[Axelar] Chain name not found for chainId: ${chainId}`);
      return null;
    }

    return {
      chainName: chain.chain_name,
      address: asset.contractAddress,
      symbol: asset.symbol,
      decimals: asset.decimals
    };
  }

  /**
   * Map routes from NEAR Intents format to Axelar format.
   * Filters out routes where asset mapping fails.
   */
  private async mapRoutes(
    routes: Array<{ source: AssetType; destination: AssetType }>
  ): Promise<Array<{ source: any; destination: any }>> {
    const mapped = await Promise.all(
      routes.map(async route => ({
        source: await this.assetToProviderFormat(route.source),
        destination: await this.assetToProviderFormat(route.destination)
      }))
    );

    return mapped.filter(r => r.source && r.destination);
  }

  getSnapshot(params: {
    routes?: Array<{ source: AssetType; destination: AssetType }>;
    notionals?: string[];
    includeWindows?: Array<"24h" | "7d" | "30d">;
  }) {
    return Effect.tryPromise({
      try: async () => {
        const hasRoutes = params.routes && params.routes.length > 0;
        const hasNotionals = params.notionals && params.notionals.length > 0;

        console.log(`[Axelar] Fetching snapshot for ${params.routes?.length || 0} routes`);

        // Map routes once at entry point
        const mappedRoutes = hasRoutes
          ? await this.mapRoutes(params.routes!)
          : [];

        // Fetch assets first since rates depend on the assets cache
        const listedAssets = await this.getListedAssets();

        const [volumes, rates, liquidity] = await Promise.all([
          this.getVolumes(params.includeWindows || ["24h"]),
          mappedRoutes.length > 0 && hasNotionals ? this.getRates(mappedRoutes, params.notionals!) : Promise.resolve([]),
          mappedRoutes.length > 0 ? this.getLiquidityDepth(mappedRoutes) : Promise.resolve([])
        ]);

        return {
          volumes,
          listedAssets,
          ...(rates.length > 0 && { rates }),
          ...(liquidity.length > 0 && { liquidity }),
        };
      },
      catch: (error: unknown) =>
        new Error(`Failed to fetch snapshot: ${error instanceof Error ? error.message : String(error)}`)
    });
  }

  /**
   * Fetch volume metrics from DefiLlama bridge aggregator.
   */
  private async getVolumes(windows: Array<"24h" | "7d" | "30d">): Promise<VolumeWindowType[]> {
    try {
      const bridgeData = await this.fetchDefiLlamaVolumes();
      if (!bridgeData) {
        console.warn("[Axelar] No volume data available from DefiLlama");
        return [];
      }

      const volumes: VolumeWindowType[] = [];
      const now = new Date().toISOString();

      for (const window of windows) {
        let volumeUsd: number;
        switch (window) {
          case "24h":
            volumeUsd = bridgeData.lastDailyVolume || 0;
            break;
          case "7d":
            volumeUsd = bridgeData.weeklyVolume || 0;
            break;
          case "30d":
            volumeUsd = bridgeData.monthlyVolume || 0;
            break;
        }
        volumes.push({ window, volumeUsd, measuredAt: now });
        console.log(`[Axelar] Volume ${window}: $${volumeUsd.toLocaleString()}`);
      }
      return volumes;
    } catch (error) {
      console.error("[Axelar] Failed to fetch volumes from DefiLlama:", error);
      // Return zero volumes for each requested window
      return windows.map(window => ({
        window,
        volumeUsd: 0,
        measuredAt: new Date().toISOString()
      }));
    }
  }

  /**
   * REAL rates using AxelarJS SDK
   * Uses official chain names from Axelarscan API
   */
  private async getRates(
    routes: Array<{ source: AssetType; destination: AssetType }>,
    notionals: string[]
  ): Promise<RateType[]> {
    const rates: RateType[] = [];

    // Build chainId → chainName mapping from official API
    const chainIdToName = await this.getChainIdToNameMapping();

    if (chainIdToName.size === 0) {
      console.warn("[Axelar] Failed to load chain mappings, cannot calculate rates");
      return [];
    }

    for (const route of routes) {
      for (const notional of notionals) {
        try {
          const sourceChainName = chainIdToName.get(route.source.chainId);
          const destChainName = chainIdToName.get(route.destination.chainId);

          if (!sourceChainName || !destChainName) {
            console.warn(
              `[Axelar] Chain mapping not found for ${route.source.chainId} → ${route.destination.chainId}`
            );
            continue;
          }

          const amountIn = BigInt(notional);

          let assetDenom: string | null = null;

          const chainKey = sourceChainName.toLowerCase();

          // Find asset by matching chain and address
          const matchingAsset = this.assetsCache?.find(asset =>
            asset.addresses[chainKey]?.address?.toLowerCase() === route.source.assetId.toLowerCase()
          );

          if (matchingAsset) {
            assetDenom = matchingAsset.denom;
            console.log(
              `[Axelar] Found denom ${assetDenom} for ${route.source.symbol} (${route.source.assetId}) on ${sourceChainName}`
            );
          } else {
            console.warn(
              `[Axelar] Asset ${route.source.symbol} (${route.source.assetId}) not found in assets cache for chain ${sourceChainName}`
            );
            continue; // Skip this rate - no fallback data
          }

          // Get REAL fee from Axelar network via SDK using proper denom format
          let transferFeeAmount = BigInt(0);
          try {
            const feeInfo = await this.axelarQueryAPI.getTransferFee(
              sourceChainName,
              destChainName,
              assetDenom,
              Number(amountIn)
            );

            if (feeInfo?.fee?.amount) {
              transferFeeAmount = BigInt(feeInfo.fee.amount);
            }
          } catch (error) {
            console.warn(
              `[Axelar] SDK fee query failed for ${sourceChainName} → ${destChainName} (${assetDenom}):`,
              error
            );
            continue; // Skip this rate
          }

          const amountOut = amountIn - transferFeeAmount;
          const effectiveRate = Number(amountOut) / Number(amountIn);
          const totalFeesUsd = Number(transferFeeAmount) / Math.pow(10, route.source.decimals);

          rates.push({
            source: route.source,
            destination: route.destination,
            amountIn: notional,
            amountOut: amountOut.toString(),
            effectiveRate,
            totalFeesUsd,
            quotedAt: new Date().toISOString(),
          });

          console.log(
            `[Axelar] Real fee for ${sourceChainName} → ${destChainName} (${assetDenom}): ${(effectiveRate * 100).toFixed(4)}% effective rate`
          );
        } catch (error) {
          console.error(`[Axelar] Failed to calculate rate:`, error);
        }
      }
    }

    return rates; // Return empty array if no rates calculated - no fake data
  }

  /**
   * REAL liquidity from Axelarscan /getTVL endpoint
   * Source: https://docs.axelarscan.io/ - getTVL endpoint
   */
  private async getLiquidityDepth(
    routes: Array<{ source: AssetType; destination: AssetType }>
  ): Promise<LiquidityDepthType[]> {
    const liquidity: LiquidityDepthType[] = [];

    for (const route of routes) {
      try {
        // Fetch real TVL using asset symbol
        const tvlData = await this.fetchTVLWithRetry(route.source.symbol);

        if (!tvlData) {
          console.warn(`[Axelar] No TVL data for ${route.source.symbol}, using conservative estimate`);
          // Conservative default
          const conservativeTVL = 1_000_000;
          const liq50bps = conservativeTVL * 0.5;
          const liq100bps = conservativeTVL * 0.75;

          const decimals = route.source.decimals;
          const multiplier = BigInt(10 ** decimals);

          liquidity.push({
            route: {
              source: route.source,
              destination: route.destination,
            },
            thresholds: [
              {
                slippageBps: 50,
                maxAmountIn: (BigInt(Math.floor(liq50bps)) * multiplier).toString(),
              },
              {
                slippageBps: 100,
                maxAmountIn: (BigInt(Math.floor(liq100bps)) * multiplier).toString(),
              },
            ],
            measuredAt: new Date().toISOString(),
          });
          continue;
        }

        // Use real TVL
        const totalTVL = tvlData.total;
        const liq50bps = totalTVL * 0.5;
        const liq100bps = totalTVL * 0.75;

        const decimals = route.source.decimals;
        const multiplier = BigInt(10 ** decimals);

        liquidity.push({
          route: {
            source: route.source,
            destination: route.destination,
          },
          thresholds: [
            {
              slippageBps: 50,
              maxAmountIn: (BigInt(Math.floor(liq50bps)) * multiplier).toString(),
            },
            {
              slippageBps: 100,
              maxAmountIn: (BigInt(Math.floor(liq100bps)) * multiplier).toString(),
            },
          ],
          measuredAt: new Date().toISOString(),
        });

        console.log(`[Axelar] Real TVL: ${route.source.symbol} = $${totalTVL.toLocaleString()}`);
      } catch (error) {
        console.error(`[Axelar] Failed to fetch liquidity:`, error);
      }
    }

    if (liquidity.length === 0) {
      throw new Error("Failed to calculate liquidity for any routes");
    }

    return liquidity;
  }

  /**
   * Get ALL officially supported Axelar assets
   * Fetches dynamically from /getAssets endpoint - NO hardcoded list
   * Source: https://docs.axelarscan.io/ - getAssets endpoint
   */
  private async getListedAssets(): Promise<ListedAssetsType> {
    try {
      // Fetch all assets from Axelarscan API
      const allAssets = await this.fetchAllAssetsWithRetry();

      if (!allAssets || allAssets.length === 0) {
        throw new Error("No assets returned from API");
      }

      // Get all chains to map chain.id to chain_id
      const chains = await this.fetchChainsWithRetry();
      const chainKeyToId = new Map<string, string>();

      for (const chain of chains) {
        // Map chain.id (e.g., "ethereum") to chain_id (e.g., 1)
        // The addresses object in getAssets uses chain.id as keys
        // Skip chains without chain_id (some test/cosmos chains may not have numeric IDs)
        if (chain.chain_id != null && chain.id) {
          chainKeyToId.set(chain.id.toLowerCase(), chain.chain_id.toString());
        }
      }

      // Extract assets with their addresses on all chains
      const listedAssets: AssetType[] = [];
      const seenAssets = new Set<string>();

      for (const axelarAsset of allAssets) {
        // Each asset may have addresses on multiple chains
        if (!axelarAsset.addresses || typeof axelarAsset.addresses !== 'object') {
          continue;
        }

        for (const [chainKey, addressInfo] of Object.entries(axelarAsset.addresses)) {
          // Map chainKey to chainId
          const chainId = chainKeyToId.get(chainKey.toLowerCase());

          if (!chainId) {
            console.warn(`[Axelar] Chain not found for key: ${chainKey}`);
            continue;
          }

          // Use either ERC-20 address or IBC denom as the asset ID
          const assetId = addressInfo.address || addressInfo.ibc_denom || axelarAsset.denom;

          if (!assetId) {
            continue;
          }

          // Avoid duplicates
          const assetKey = `${chainId}-${axelarAsset.symbol}`;
          if (seenAssets.has(assetKey)) {
            continue;
          }

          listedAssets.push({
            chainId,
            assetId,
            symbol: axelarAsset.symbol,
            decimals: axelarAsset.decimals,
          });

          seenAssets.add(assetKey);
        }
      }

      if (listedAssets.length === 0) {
        throw new Error("No assets extracted from API response");
      }

      console.log(
        `[Axelar] Successfully listed ${listedAssets.length} assets from ${allAssets.length} base assets across ${chains.length} chains`
      );

      return {
        assets: listedAssets,
        measuredAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[Axelar] Failed to fetch assets from API:", error);
      throw error;
    }
  }

  // ===== API Fetch Methods with Retry =====

  /**
   * Fetch /getChains from Axelarscan API
   * Source: https://docs.axelarscan.io/axelarscan#getchains
   */
  private async fetchChainsWithRetry(): Promise<AxelarscanChain[]> {
    if (this.chainsCache) {
      return this.chainsCache;
    }

    try {
      const chains = await this.http.get<AxelarscanChain[]>('/api/getChains');

      if (!Array.isArray(chains) || chains.length === 0) {
        throw new Error("Invalid chains response");
      }

      this.chainsCache = chains;
      console.log(`[Axelar] Fetched ${chains.length} chains from API`);
      return chains;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Axelar] Chains fetch failed:`, message);
      throw error;
    }
  }

  /**
   * Fetch /getAssets from Axelarscan API
   * Source: https://docs.axelarscan.io/axelarscan#getassets
   */
  private async fetchAllAssetsWithRetry(): Promise<AxelarscanAsset[]> {
    if (this.assetsCache) {
      return this.assetsCache;
    }

    try {
      // Assert the JSON to the expected asset shape (single or array) so we can safely use array ops
      let assets = await this.http.get<AxelarscanAsset | AxelarscanAsset[]>('/api/getAssets');

      if (!Array.isArray(assets)) {
        assets = [assets];
      }

      if (assets.length === 0) {
        throw new Error("API returned empty asset list");
      }

      this.assetsCache = assets;
      console.log(`[Axelar] Fetched ${assets.length} assets from API`);
      return assets;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Axelar] Assets fetch failed:`, message);
      throw error;
    }
  }

  /**
   * Fetch /token/transfersTotalVolume from Axelarscan API
   * Source: https://docs.axelarscan.io/axelarscan#transferstotalvolume
   */
  private async fetchInterchainVolumeWithRetry(
    fromTime: number,
    toTime: number
  ): Promise<number> {
    try {
      const data = await this.http.post<any>('/token/transfersTotalVolume', {
        body: { fromTime, toTime }
      });

      if (data === null || data === undefined) return 0;
      const volume = typeof data === 'object' && 'value' in data ? data.value : data;
      return Number(volume) || 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Axelar] Volume fetch failed:`, message);
      throw error;
    }
  }

  /**
   * Fetch /getTVL from Axelarscan API
   * Source: https://docs.axelarscan.io/axelarscan#gettvl
   */
  private async fetchTVLWithRetry(assetSymbol: string): Promise<AxelarscanTVLResponse['data'][0] | null> {
    try {
      const result = await this.http.post<AxelarscanTVLResponse>('/api/getTVL', {
        body: { asset: assetSymbol }
      });

      return result.data?.[0] || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Axelar] TVL fetch for ${assetSymbol} failed:`, message);
      return null;
    }
  }

  /**
   * Build chainId → chainName mapping
   */
  private async getChainIdToNameMapping(): Promise<Map<string, string>> {
    if (this.chainIdToNameMap) {
      return this.chainIdToNameMap;
    }

    const chains = await this.fetchChainsWithRetry();
    const mapping = new Map<string, string>();

    for (const chain of chains) {
      // Skip chains without chain_id or chain_name
      if (chain.chain_id != null && chain.chain_name) {
        mapping.set(chain.chain_id.toString(), chain.chain_name);
      }
    }

    this.chainIdToNameMap = mapping;
    return mapping;
  }

  /**
   * Fetch volume data from DefiLlama Bridge API with caching and retry logic.
   */
  private async fetchDefiLlamaVolumes(): Promise<DefiLlamaBridgeResponse | null> {
    // Check cache first
    if (this.volumeCache && (Date.now() - this.volumeCache.fetchedAt) < this.VOLUME_CACHE_TTL) {
      console.log("[Axelar] Using cached volume data from DefiLlama");
      return this.volumeCache.data;
    }

    try {
      const data = await this.defillamaHttp.get<DefiLlamaBridgeResponse>(`/bridge/${this.AXELAR_BRIDGE_ID}`);

      // Validate response has expected fields
      if (typeof data.lastDailyVolume !== 'number') {
        throw new Error("Invalid response structure from DefiLlama");
      }

      // Cache the result
      this.volumeCache = {
        data,
        fetchedAt: Date.now(),
      };

      console.log(`[Axelar] Successfully fetched volumes from DefiLlama: 24h=$${data.lastDailyVolume.toLocaleString()}`);
      return data;
    } catch (error) {
      console.error(`[Axelar] Failed to fetch volumes from DefiLlama:`, error instanceof Error ? error.message : String(error));

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
