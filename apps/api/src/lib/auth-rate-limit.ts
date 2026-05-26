import { queryFirst, run } from "./db";
import { newId } from "./id";

type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface D1RateLimiterOptions {
  scope: string;
  maxRequests: number;
  windowSeconds: number;
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureAuthRateLimitTable(db: D1Database): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await run(
        db,
        `CREATE TABLE IF NOT EXISTS auth_rate_limit_events (
          id TEXT PRIMARY KEY,
          scope TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL
        )`
      );
      await run(
        db,
        "CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_scope_key_created ON auth_rate_limit_events(scope, key_hash, created_at_ms)"
      );
    })().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  await ensureTablePromise;
}

async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export class D1RateLimiter {
  private readonly scope: string;
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: D1RateLimiterOptions) {
    this.scope = options.scope;
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowSeconds * 1000;
  }

  async check(db: D1Database, rawKey: string): Promise<RateLimitResult> {
    await ensureAuthRateLimitTable(db);

    const now = Date.now();
    const cutoff = now - this.windowMs;
    const keyHash = await sha256Base64(`${this.scope}:${rawKey.trim().toLowerCase()}`);

    await run(
      db,
      "DELETE FROM auth_rate_limit_events WHERE scope = ? AND key_hash = ? AND created_at_ms <= ?",
      [this.scope, keyHash, cutoff]
    );

    const row = await queryFirst<{ request_count: number; oldest_request_ms: number | null }>(
      db,
      `SELECT COUNT(*) as request_count, MIN(created_at_ms) as oldest_request_ms
       FROM auth_rate_limit_events
       WHERE scope = ? AND key_hash = ?`,
      [this.scope, keyHash]
    );

    const requestCount = Number(row?.request_count ?? 0);
    const oldestRequestMs = row?.oldest_request_ms == null ? null : Number(row.oldest_request_ms);

    if (requestCount >= this.maxRequests && oldestRequestMs !== null) {
      const retryAfterSeconds = Math.ceil((oldestRequestMs + this.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }

    await run(
      db,
      "INSERT INTO auth_rate_limit_events (id, scope, key_hash, created_at_ms) VALUES (?, ?, ?, ?)",
      [newId(), this.scope, keyHash, now]
    );

    return { allowed: true };
  }
}

export const loginLimiter = new D1RateLimiter({ scope: "auth_login_ip", maxRequests: 5, windowSeconds: 900 });
export const magicLinkLimiter = new D1RateLimiter({ scope: "auth_magic_link_email", maxRequests: 3, windowSeconds: 900 });
