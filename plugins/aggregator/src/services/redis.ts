import { Effect } from "every-plugin/effect";
import { Redis } from "ioredis";

export class RedisError extends Error {
  readonly _tag = "RedisError" as const;
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "RedisError";
  }
}

export class RedisService {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  get<T>(key: string): Effect.Effect<T | null, RedisError> {
    return Effect.tryPromise({
      try: async () => {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) as T : null;
      },
      catch: (error) => new RedisError(`Failed to get key ${key}`, error)
    });
  }

  set<T>(key: string, value: T, ttlSeconds: number = 86400): Effect.Effect<void, RedisError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      },
      catch: (error) => new RedisError(`Failed to set key ${key}`, error)
    });
  }

  del(key: string): Effect.Effect<void, RedisError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.del(key);
      },
      catch: (error) => new RedisError(`Failed to delete key ${key}`, error)
    });
  }

  clear(pattern: string): Effect.Effect<number, RedisError> {
    return Effect.tryPromise({
      try: async () => {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
        return keys.length;
      },
      catch: (error) => new RedisError(`Failed to clear pattern ${pattern}`, error)
    });
  }

  healthCheck(): Effect.Effect<string, RedisError> {
    return Effect.tryPromise({
      try: async () => {
        await this.client.ping();
        return "OK";
      },
      catch: (error) => new RedisError("Redis health check failed", error)
    });
  }

  async quit(): Promise<void> {
    await this.client.quit();
  }
}
