/**
 * TTL (Time-To-Live) Cache implementation
 * Reduces API load by caching frequently accessed data
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /**
   * Get cached value if not expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value with TTL
   */
  set(key: K, value: V): void {
    // Enforce max size (LRU-like behavior)
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number; ttlMs: number } {
    // Clean expired entries before reporting stats
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

/**
 * Request Deduplicator - prevents duplicate concurrent requests
 * If the same request is made while one is in-flight, return the existing promise
 */
export class RequestDeduplicator<T> {
  private pending = new Map<string, Promise<T>>();

  /**
   * Deduplicate concurrent requests with the same key
   */
  async deduplicate(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing; // Return in-flight request
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pending.clear();
  }

  /**
   * Get number of pending requests
   */
  pendingCount(): number {
    return this.pending.size;
  }
}

/**
 * Circuit Breaker - fail fast when external service is down
 * Prevents cascading failures and reduces load on failing services
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private nextAttemptTime = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly successThreshold = 2
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // If circuit is OPEN and cooldown hasn't expired, fail fast
    if (this.state === 'OPEN') {
      if (now < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN - service is unavailable');
      }
      // Cooldown expired, try HALF_OPEN
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (
      this.state === 'HALF_OPEN' ||
      this.failureCount >= this.failureThreshold
    ) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.cooldownMs;
    }
  }

  /**
   * Get current state
   */
  getState(): { state: string; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }

  /**
   * Force reset to CLOSED state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }
}

