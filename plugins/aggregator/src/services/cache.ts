import { Effect } from "every-plugin/effect";

export class CacheError extends Error {
  readonly _tag = "CacheError" as const;
  constructor(
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "CacheError";
  }
}

export interface CacheService {
  get<T>(key: string): Effect.Effect<T | null, CacheError>;
  set<T>(key: string, value: T, ttlSeconds?: number): Effect.Effect<void, CacheError>;
  del(key: string): Effect.Effect<void, CacheError>;
  clear(pattern: string): Effect.Effect<number, CacheError>;
  healthCheck(): Effect.Effect<string, CacheError>;
  quit(): Promise<void>;
}

export class MemoryCache implements CacheService {
  private cache = new Map<string, { value: string; expiresAt: number | null }>();
  private cleanupInterval: Timer | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  get<T>(key: string): Effect.Effect<T | null, CacheError> {
    return Effect.sync(() => {
      const entry = this.cache.get(key);
      if (!entry) return null;

      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      return JSON.parse(entry.value) as T;
    });
  }

  set<T>(key: string, value: T, ttlSeconds: number = 86400): Effect.Effect<void, CacheError> {
    return Effect.sync(() => {
      const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
      this.cache.set(key, {
        value: JSON.stringify(value),
        expiresAt,
      });
    });
  }

  del(key: string): Effect.Effect<void, CacheError> {
    return Effect.sync(() => {
      this.cache.delete(key);
    });
  }

  clear(pattern: string): Effect.Effect<number, CacheError> {
    return Effect.sync(() => {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      let count = 0;
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
      
      return count;
    });
  }

  healthCheck(): Effect.Effect<string, CacheError> {
    return Effect.succeed("OK");
  }

  async quit(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}
