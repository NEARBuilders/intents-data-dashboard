import { Effect } from "every-plugin/effect";
import { Redis } from "ioredis";
import type { CacheService } from "./cache";
import { CacheError } from "./cache";

export class RedisService implements CacheService {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }

  get<T>(key: string): Effect.Effect<T | null, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) as T : null;
      },
      catch: (error) => new CacheError(`Failed to get key ${key}`, error)
    });
  }

  set<T>(key: string, value: T, ttlSeconds: number = 86400): Effect.Effect<void, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      },
      catch: (error) => new CacheError(`Failed to set key ${key}`, error)
    });
  }

  del(key: string): Effect.Effect<void, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.del(key);
      },
      catch: (error) => new CacheError(`Failed to delete key ${key}`, error)
    });
  }

  clear(pattern: string): Effect.Effect<number, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
        return keys.length;
      },
      catch: (error) => new CacheError(`Failed to clear pattern ${pattern}`, error)
    });
  }

  healthCheck(): Effect.Effect<string, CacheError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.ping();
        return "OK";
      },
      catch: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                                  errorMessage.includes('connect') ||
                                  errorMessage.includes('ENOTFOUND');
        
        if (isConnectionError) {
          console.error('\n❌ Redis connection failed - Docker not running?');
          console.error('   Run: docker compose up -d\n');
          return new CacheError(
            'Redis is not available. Start Redis with: docker compose up -d',
            error
          );
        }
        
        return new CacheError("Redis health check failed", error);
      }
    });
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}
