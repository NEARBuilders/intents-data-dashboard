import { Effect } from 'every-plugin/effect';
import type { RedisService } from './redis';

interface CoinMarketCapQuote {
  id: number;
  name: string;
  symbol: string;
  slug: string;
}

interface CoinMarketCapResponse {
  data: CoinMarketCapQuote[];
  status: {
    error_code: number;
    error_message: string | null;
  };
}

interface CoinGeckoQuote {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  large: string;
}

interface CoinGeckoSearchResponse {
  coins: CoinGeckoQuote[];
}

interface IconMatch {
  url: string;
  confidence: number;
}

interface RateLimitState {
  hitAt: number;
  backoffUntil: number;
  failureCount: number;
}

const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60 * 60 * 24 * 7;
const FAILED_LOOKUP_TTL = 60 * 60;
const MAX_ENRICHMENT_PER_CALL = 10;
const REQUEST_DELAY = 4000;

export class IconResolverService {
  private redis: RedisService;
  private coinmarketcapApiKey?: string;
  private readonly CACHE_TTL = 60 * 60 * 24 * 7;
  private readonly FAILED_LOOKUP_TTL = 60 * 60;
  private readonly REQUEST_DELAY = 4000;
  private readonly MAX_ENRICHMENT_PER_CALL = 10;

  constructor(redis: RedisService, coinmarketcapApiKey?: string) {
    this.redis = redis;
    this.coinmarketcapApiKey = coinmarketcapApiKey;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async checkRateLimitState(provider: 'cmc' | 'coingecko'): Promise<boolean> {
    const key = `rate-limit:${provider}`;
    const state = await Effect.runPromise(this.redis.get<RateLimitState>(key));
    
    if (!state) {
      return false;
    }

    const now = Date.now();
    if (now < state.backoffUntil) {
      return true;
    }

    await Effect.runPromise(this.redis.del(key));
    return false;
  }

  private async recordRateLimit(provider: 'cmc' | 'coingecko'): Promise<void> {
    const key = `rate-limit:${provider}`;
    const state = await Effect.runPromise(this.redis.get<RateLimitState>(key));
    
    const now = Date.now();
    const failureCount = state ? state.failureCount + 1 : 1;
    
    const backoffDurations = [60, 300, 1800, 7200];
    const backoffSeconds = backoffDurations[Math.min(failureCount - 1, backoffDurations.length - 1)] || 60;
    const backoffUntil = now + (backoffSeconds * 1000);

    const newState: RateLimitState = {
      hitAt: now,
      backoffUntil,
      failureCount,
    };

    await Effect.runPromise(this.redis.set(key, newState, backoffSeconds + 60));
    
    const backoffMinutes = Math.round(backoffSeconds / 60);
    console.log(`[IconResolver] ${provider} rate limited. Backing off for ${backoffMinutes} minutes (attempt ${failureCount})`);
  }

  private async isFailedLookup(symbol: string, blockchain?: string): Promise<boolean> {
    const key = `icon:failed:${symbol}:${blockchain || 'any'}`;
    const failed = await Effect.runPromise(this.redis.get<boolean>(key));
    return failed === true;
  }

  private async recordFailedLookup(symbol: string, blockchain?: string): Promise<void> {
    const key = `icon:failed:${symbol}:${blockchain || 'any'}`;
    await Effect.runPromise(this.redis.set(key, true, this.FAILED_LOOKUP_TTL));
  }

  async getAssetIconUrl(
    symbol: string,
    blockchain?: string
  ): Promise<string | undefined> {
    const cacheKey = `icon:${symbol}:${blockchain || 'any'}`;
    
    const cached = await Effect.runPromise(this.redis.get<string>(cacheKey));
    if (cached) {
      return cached;
    }

    if (await this.isFailedLookup(symbol, blockchain)) {
      return undefined;
    }

    const bestMatch = await this.findBestIconMatch(symbol, blockchain);
    
    if (bestMatch) {
      await Effect.runPromise(this.redis.set<string>(cacheKey, bestMatch, CACHE_TTL));
      return bestMatch;
    }

    await this.recordFailedLookup(symbol, blockchain);
    return undefined;
  }

  async enrichAssetsWithIcons<T extends { symbol: string; blockchain: string; iconUrl?: string }>(
    assets: T[]
  ): Promise<T[]> {
    const assetsNeedingIcons = assets.filter(asset => !asset.iconUrl);
    
    if (assetsNeedingIcons.length === 0) {
      return assets;
    }

    const cmcLimited = await this.checkRateLimitState('cmc');
    const cgLimited = await this.checkRateLimitState('coingecko');
    
    if (cmcLimited && cgLimited) {
      console.log('[IconResolver] Both APIs rate limited. Skipping icon enrichment.');
      return assets;
    }

    const limitedAssets = assetsNeedingIcons.slice(0, this.MAX_ENRICHMENT_PER_CALL);
    const enrichedAssets = [...assets];
    
    for (let i = 0; i < limitedAssets.length; i++) {
      const asset = limitedAssets[i];
      if (!asset) continue;
      
      const iconUrl = await this.getAssetIconUrl(asset.symbol, asset.blockchain);
      const index = enrichedAssets.findIndex(a => a.symbol === asset.symbol && a.blockchain === asset.blockchain);
      if (index !== -1 && iconUrl) {
        enrichedAssets[index] = { ...enrichedAssets[index], iconUrl } as T;
      }
      
      if (i < limitedAssets.length - 1) {
        await this.delay(this.REQUEST_DELAY);
      }
    }
    
    const remaining = assetsNeedingIcons.length - limitedAssets.length;
    if (remaining > 0) {
      console.log(`[IconResolver] Enriched ${limitedAssets.length} assets, ${remaining} remaining for next request`);
    }
    
    return enrichedAssets;
  }

  private async findBestIconMatch(
    symbol: string,
    blockchain?: string
  ): Promise<string | undefined> {
    const matches: IconMatch[] = [];

    const cmcMatch = await this.tryMatchCoinMarketCap(symbol, blockchain);
    if (cmcMatch) {
      matches.push(cmcMatch);
    }

    const cgMatch = await this.tryMatchCoinGecko(symbol);
    if (cgMatch) {
      matches.push(cgMatch);
    }

    if (matches.length === 0) {
      return undefined;
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches[0]?.url;
  }

  private async tryMatchCoinMarketCap(
    symbol: string,
    blockchain?: string
  ): Promise<IconMatch | null> {
    if (!this.coinmarketcapApiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${CMC_BASE_URL}/cryptocurrency/map?symbol=${symbol.toUpperCase()}`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': this.coinmarketcapApiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          await this.recordRateLimit('cmc');
        }
        return null;
      }

      const data = await response.json() as CoinMarketCapResponse;

      if (data.status.error_code !== 0 || !data.data || data.data.length === 0) {
        return null;
      }

      const exactMatch = data.data.find(
        (coin) => coin.symbol.toLowerCase() === symbol.toLowerCase()
      );

      if (exactMatch) {
        const confidence = blockchain ? 95 : 100;
        return {
          url: `https://s2.coinmarketcap.com/static/img/coins/64x64/${exactMatch.id}.png`,
          confidence,
        };
      }

      const fuzzyMatch = data.data[0];
      if (fuzzyMatch) {
        return {
          url: `https://s2.coinmarketcap.com/static/img/coins/64x64/${fuzzyMatch.id}.png`,
          confidence: 70,
        };
      }

      return null;
    } catch (error) {
      console.warn('[IconResolver] CMC API request failed:', error);
      return null;
    }
  }

  private async tryMatchCoinGecko(symbol: string): Promise<IconMatch | null> {
    try {
      const response = await fetch(
        `${COINGECKO_BASE_URL}/search?query=${encodeURIComponent(symbol)}`
      );

      if (!response.ok) {
        if (response.status === 429) {
          await this.recordRateLimit('coingecko');
        }
        return null;
      }

      const data = await response.json() as CoinGeckoSearchResponse;

      if (!data.coins || data.coins.length === 0) {
        return null;
      }

      const exactMatch = data.coins.find(
        (coin) => coin.symbol.toLowerCase() === symbol.toLowerCase()
      );

      if (exactMatch) {
        return {
          url: exactMatch.large,
          confidence: 95,
        };
      }

      const fuzzyMatch = data.coins[0];
      if (fuzzyMatch) {
        return {
          url: fuzzyMatch.large,
          confidence: 65,
        };
      }

      return null;
    } catch (error) {
      console.warn('[IconResolver] CoinGecko API request failed:', error);
      return null;
    }
  }
}
