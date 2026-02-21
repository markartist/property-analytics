/**
 * In-memory sliding-window rate limiter for Cloudflare Workers.
 *
 * DEV-ONLY: In-memory state resets on Worker cold start and is per-isolate,
 * meaning it won't share state across multiple Worker instances.
 * TODO: Replace with Durable Objects for production-grade distributed rate limiting.
 *
 * Usage: create a limiter, then call `check(key)` in middleware.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOpts {
  /** Maximum requests allowed within the window. */
  maxRequests: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(opts: RateLimiterOpts) {
    this.maxRequests = opts.maxRequests;
    this.windowMs = opts.windowSeconds * 1000;
  }

  /**
   * Check if a request should be allowed.
   * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
   */
  check(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterSeconds = Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    entry.timestamps.push(now);
    return { allowed: true };
  }

  /** Periodic cleanup of stale entries to prevent memory leak. Call sparingly. */
  prune(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) this.store.delete(key);
    }
  }
}

// --- Pre-configured limiters ---

/** Login: 5 attempts per 15 minutes per IP. */
export const loginLimiter = new RateLimiter({ maxRequests: 5, windowSeconds: 900 });

/** Scan-mentions: 10 requests per minute per user. */
export const scanMentionsLimiter = new RateLimiter({ maxRequests: 10, windowSeconds: 60 });

/** Email send (if enabled): 20 emails per minute globally. */
export const emailSendLimiter = new RateLimiter({ maxRequests: 20, windowSeconds: 60 });
