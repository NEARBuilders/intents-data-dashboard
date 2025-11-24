import { Coingecko } from '@coingecko/coingecko-typescript';
import type { AssetMetadata, RegistryClient } from "./types";

const BLOCKCHAIN_TO_PLATFORM: Record<string, string> = {
  eth: 'ethereum',

  arb: "arbitrum-one",
  arbitrum: "arbitrum-one",
  arb1: "arbitrum-one",

  pol: 'polygon-pos',
  polygon: "polygon-pos",
  matic: "polygon-pos",

  bsc: 'binance-smart-chain',
  bnb: 'binance-smart-chain',

  op: 'optimistic-ethereum',
  optimism: 'optimistic-ethereum',

  sol: 'solana',
  solana: 'solana',

  base: 'base',
  bera: 'berachain',
  near: 'near-protocol',
  ton: 'the-open-network',
  tron: 'tron',
  aptos: 'aptos',
  sui: 'sui',
  
  avax: 'avalanche',
  avalanche: 'avalanche',
  
  ftm: 'fantom',
  celo: 'celo',
  gnosis: 'xdai',
  zksync: "zksync",
  linea: "linea",
  mantle: "mantle",
  opbnb: "opbnb",
  scroll: "scroll",
  "polygon-zkevm": "polygon-zkevm",
};

// Map canonical blockchain slugs to native coin IDs
const NATIVE_COIN_IDS: Record<string, string> = {
  eth: 'ethereum',
  arb: 'ethereum',
  arbitrum: 'ethereum',
  op: 'ethereum',
  optimism: 'ethereum',
  base: 'ethereum',
  pol: 'matic-network',
  matic: 'matic-network',
  polygon: 'matic-network',
  bsc: 'binancecoin',
  bnb: 'binancecoin',
  sol: 'solana',
  near: 'near',
  ton: 'the-open-network',
  tron: 'tron',
  aptos: 'aptos',
  sui: 'sui',
  avax: 'avalanche-2',
  ftm: 'fantom',
  celo: 'celo',
  btc: 'bitcoin',
  doge: 'dogecoin',
  xrp: 'ripple',
  zec: 'zcash',
  ltc: 'litecoin',
  stellar: 'stellar',
  cardano: 'cardano',
  bera: 'berachain',
  gnosis: 'xdai',
  zksync: 'ethereum',
  linea: 'ethereum',
  mantle: 'mantle',
  scroll: 'ethereum',
  'polygon-zkevm': 'ethereum',
  opbnb: 'binancecoin',
  plasma: 'plasma',
  lens: 'lens',
  blast: "blast",
  blastmainnet: "blast",
};

export class CoingeckoRegistry implements RegistryClient {
  private client: Coingecko;
  private cache = new Map<string, { data: AssetMetadata; timestamp: number }>();
  private negativeCache = new Map<string, number>();
  private CACHE_TTL = 3600_000; // 1 hour
  private rateLimitedUntil: number | null = null;

  constructor(opts?: { proAPIKey?: string | null; demoAPIKey?: string | null }) {
    this.client = new Coingecko({
      proAPIKey: opts?.proAPIKey ?? null,
      demoAPIKey: opts?.demoAPIKey ?? null,
      environment: opts?.proAPIKey ? 'pro' : 'demo',
    });
  }

  private isRateLimited(): boolean {
    return this.rateLimitedUntil !== null && Date.now() < this.rateLimitedUntil;
  }

  private setRateLimit(resetHeader?: string): void {
    const resetAt = resetHeader ? Date.parse(resetHeader) : Date.now() + 60_000;
    this.rateLimitedUntil = resetAt;
    console.warn(`[CoingeckoRegistry] Rate limited, backing off until ${new Date(resetAt).toISOString()}`);
  }

  private isNegativelyCached(key: string): boolean {
    const timestamp = this.negativeCache.get(key);
    if (timestamp && Date.now() - timestamp < this.CACHE_TTL) {
      return true;
    }
    this.negativeCache.delete(key);
    return false;
  }

  private setNegativeCache(key: string): void {
    this.negativeCache.set(key, Date.now());
  }

  private getCacheKey(type: string, ...args: string[]): string {
    return `${type}:${args.join(':')}`.toLowerCase();
  }

  private getCached(key: string): AssetMetadata | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: AssetMetadata): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async findByReference(blockchain: string, reference: string): Promise<AssetMetadata | null> {
    const cacheKey = this.getCacheKey('ref', blockchain, reference);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (this.isNegativelyCached(cacheKey)) {
      return null;
    }

    if (this.isRateLimited()) {
      return null;
    }

    const platformId = BLOCKCHAIN_TO_PLATFORM[blockchain.toLowerCase()];
    if (!platformId) {
      console.warn(`[CoingeckoRegistry] Unknown blockchain: ${blockchain}`);
      return null;
    }

    try {
      const response = await this.client.coins.contract.get(reference.toLowerCase(), {
        id: platformId,
      });

      const decimals = response.detail_platforms?.[platformId]?.decimal_place ?? undefined;
      const iconUrl = response.image?.large || response.image?.small || response.image?.thumb;

      const metadata: AssetMetadata = {
        symbol: response.symbol?.toUpperCase(),
        decimals,
        iconUrl,
        name: response.name,
      };

      this.setCache(cacheKey, metadata);
      return metadata;
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      const errorMsg = error?.error?.error ?? error?.response?.data?.error ?? error?.message;

      if (status === 404 && errorMsg === "coin not found") {
        console.warn(`[CoingeckoRegistry] Token not found: ${blockchain}:${reference}`);
        this.setNegativeCache(cacheKey);
        return null;
      }

      if (status === 429) {
        const resetHeader = error?.headers?.get?.('x-ratelimit-reset') ?? error?.headers?.['x-ratelimit-reset'];
        this.setRateLimit(resetHeader);
        return null;
      }

      console.warn(`[CoingeckoRegistry] Error finding by reference (${status ?? "unknown"}): ${errorMsg ?? String(error)}`);
      return null;
    }
  }

  async findBySymbol(symbol: string, blockchain: string): Promise<AssetMetadata | null> {
    const cacheKey = this.getCacheKey('symbol', blockchain, symbol);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (this.isRateLimited()) {
      return null;
    }

    try {
      const search = await this.client.search.get({ query: symbol });

      const platformId = BLOCKCHAIN_TO_PLATFORM[blockchain.toLowerCase()];

      const candidate = search.coins?.find(
        (c) => c.symbol?.toLowerCase() === symbol.toLowerCase()
      );

      if (!candidate || !candidate.id) {
        return null;
      }

      const details = await this.client.coins.getID(candidate.id, {
        localization: false,
        tickers: false,
        market_data: false,
        community_data: false,
        developer_data: false,
        sparkline: false,
      });

      const decimals =
        platformId ? details.detail_platforms?.[platformId]?.decimal_place ?? undefined : undefined;

      const iconUrl = details.image?.large || details.image?.small || details.image?.thumb;

      const metadata: AssetMetadata = {
        symbol: details.symbol?.toUpperCase(),
        decimals,
        iconUrl,
        name: details.name,
      };

      this.setCache(cacheKey, metadata);
      return metadata;
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      const errorMsg = error?.error?.error ?? error?.response?.data?.error ?? error?.message;

      if (status === 429) {
        const resetHeader = error?.headers?.get?.('x-ratelimit-reset') ?? error?.headers?.['x-ratelimit-reset'];
        this.setRateLimit(resetHeader);
        return null;
      }

      console.warn(`[CoingeckoRegistry] Error finding by symbol (${status ?? "unknown"}): ${errorMsg ?? String(error)}`);
      return null;
    }
  }

  async getNativeCoin(blockchain: string): Promise<AssetMetadata | null> {
    const cacheKey = this.getCacheKey('native', blockchain);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (this.isRateLimited()) {
      return null;
    }

    const coinId = NATIVE_COIN_IDS[blockchain.toLowerCase()];
    if (!coinId) {
      console.warn(`[CoingeckoRegistry] Unknown native coin for blockchain: ${blockchain}`);
      return null;
    }

    try {
      const response = await this.client.coins.getID(coinId, {
        localization: false,
        tickers: false,
        market_data: false,
        community_data: false,
        developer_data: false,
        sparkline: false,
      });

      const platformId = BLOCKCHAIN_TO_PLATFORM[blockchain.toLowerCase()];
      const decimals =
        platformId ? response.detail_platforms?.[platformId]?.decimal_place ?? undefined : undefined;

      const iconUrl = response.image?.large || response.image?.small || response.image?.thumb;

      const metadata: AssetMetadata = {
        symbol: response.symbol?.toUpperCase(),
        decimals: decimals ?? 18,
        iconUrl,
        name: response.name,
      };

      this.setCache(cacheKey, metadata);
      return metadata;
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      const errorMsg = error?.error?.error ?? error?.response?.data?.error ?? error?.message;

      if (status === 404) {
        console.warn(`[CoingeckoRegistry] Native coin not found for blockchain: ${blockchain} (coinId: ${coinId})`);
        return null;
      }

      if (status === 429) {
        const resetHeader = error?.headers?.get?.('x-ratelimit-reset') ?? error?.headers?.['x-ratelimit-reset'];
        this.setRateLimit(resetHeader);
        return null;
      }

      console.warn(`[CoingeckoRegistry] Error getting native coin (${status ?? "unknown"}): ${errorMsg ?? String(error)}`);
      return null;
    }
  }
}
