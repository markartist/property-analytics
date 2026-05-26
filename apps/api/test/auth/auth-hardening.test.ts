import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { run } from "../../src/lib/db";
import { hashPassword, generateToken } from "../../src/lib/crypto";
import { resolveSession } from "../../src/middleware/auth";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { buildCloudflareAccessJwt } from "../helpers/cloudflare-access-jwt";

async function createAuthTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      deleted_at TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT,
      updated_by TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE magic_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    )`
  );
}

test("GET /v1/auth/me rejects a JWT with the wrong Access audience", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
    await createAuthTables(db);
    await run(
      db,
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_aud', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);
    env.CLOUDFLARE_ACCESS_AUD = "expected-browser-aud";
    const teamDomain = "https://aud-test-multi.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      aud: "different-aud",
      commonName: "Mark Laufhutte",
      email: "mlaufhutte@venterraliving.com",
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/cdn-cgi/access/certs")) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input);
    }) as typeof fetch;

    const response = await app.request(
      "http://localhost/v1/auth/me",
      {
        headers: {
          "cf-access-jwt-assertion": token,
          "cf-access-authenticated-user-email": "mlaufhutte@venterraliving.com",
        },
      },
      env
    );

    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("GET /v1/auth/me accepts a JWT when one of the configured Access audiences matches", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
    await createAuthTables(db);
    await run(
      db,
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_multi_aud', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);
    env.CLOUDFLARE_ACCESS_AUD = "expected-browser-aud,api-bootstrap-aud";
    const teamDomain = "https://aud-test.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      aud: "api-bootstrap-aud",
      commonName: "Mark Laufhutte",
      email: "mlaufhutte@venterraliving.com",
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/cdn-cgi/access/certs")) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input);
    }) as typeof fetch;

    const response = await app.request(
      "http://localhost/v1/auth/me",
      {
        headers: {
          "cf-access-jwt-assertion": token,
          "cf-access-authenticated-user-email": "mlaufhutte@venterraliving.com",
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.user.email, "mlaufhutte@venterraliving.com");
    assert.equal(payload.bootstrap, "cloudflare_access");
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("POST /v1/auth/verify treats malformed magic-link tokens as invalid instead of 500", async () => {
  const { db, close } = await createTestD1Database();

  try {
    await createAuthTables(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/auth/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "!not-base64url!" }),
      },
      env
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error.code, "INVALID_TOKEN");
  } finally {
    close();
  }
});

test("POST /v1/auth/login enforces a shared D1-backed rate limit", async () => {
  const { db, close } = await createTestD1Database();

  try {
    await createAuthTables(db);
    const env = createPlatformRouteEnv(db);
    const passwordHash = await hashPassword("correct horse battery staple");
    await run(
      db,
      `INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
       VALUES ('user_login', 'rate-limit@venterraliving.com', 'Rate Limit User', ?, 'viewer', 1, datetime('now'), datetime('now'))`,
      [passwordHash]
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await app.request(
        "http://localhost/v1/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "cf-connecting-ip": "198.51.100.77",
          },
          body: JSON.stringify({
            email: "rate-limit@venterraliving.com",
            password: "wrong-password",
          }),
        },
        env
      );
      assert.equal(response.status, 401);
    }

    const blocked = await app.request(
      "http://localhost/v1/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "cf-connecting-ip": "198.51.100.77",
        },
        body: JSON.stringify({
          email: "rate-limit@venterraliving.com",
          password: "wrong-password",
        }),
      },
      env
    );

    assert.equal(blocked.status, 429);
    assert.match(blocked.headers.get("Retry-After") ?? "", /^[1-9]\d*$/);
  } finally {
    close();
  }
});

test("resolveSession returns distinct revoked and expired states", async () => {
  const { db, close } = await createTestD1Database();

  try {
    await createAuthTables(db);
    await run(
      db,
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_session', 'session@venterraliving.com', 'Session User', 'viewer', 1, datetime('now'), datetime('now'))`
    );

    const revokedToken = await generateToken();
    const expiredToken = await generateToken();

    await run(
      db,
      `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
       VALUES ('session_revoked', 'user_session', ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      [revokedToken.hash, new Date(Date.now() + 60_000).toISOString()]
    );
    await run(
      db,
      `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, created_at, updated_at)
       VALUES ('session_expired', 'user_session', ?, ?, datetime('now'), datetime('now'))`,
      [expiredToken.hash, new Date(Date.now() - 60_000).toISOString()]
    );

    assert.deepEqual(await resolveSession(db, revokedToken.raw), { status: "revoked" });
    assert.deepEqual(await resolveSession(db, expiredToken.raw), { status: "expired" });
    assert.deepEqual(await resolveSession(db, "!bad-token!"), { status: "unknown" });
  } finally {
    close();
  }
});
