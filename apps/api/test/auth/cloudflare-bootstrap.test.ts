import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { run, queryFirst } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { buildCloudflareAccessJwt } from "../helpers/cloudflare-access-jwt";

test("GET /v1/auth/me bootstraps a Data Pond session from Cloudflare Access identity", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
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
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_1', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);
    const teamDomain = "https://macxs.cloudflareaccess.com";
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      commonName: "mlaufhutte@venterraliving.com",
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

    const setCookie = response.headers.get("Set-Cookie");
    assert.ok(setCookie?.includes("pop_session="));

    const sessionCount = await queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM sessions WHERE user_id = ?",
      ["user_1"]
    );
    assert.equal(sessionCount?.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("GET /v1/auth/me bootstraps from CF_Authorization cookie when JWT assertion header is unavailable", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
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
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_2', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);
    const teamDomain = "https://cookie-test.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      commonName: "mlaufhutte@venterraliving.com",
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
          cookie: `CF_Authorization=${token}`,
          "cf-access-authenticated-user-email": "mlaufhutte@venterraliving.com",
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.user.email, "mlaufhutte@venterraliving.com");
    assert.equal(payload.bootstrap, "cloudflare_access");

    const setCookie = response.headers.get("Set-Cookie");
    assert.ok(setCookie?.includes("pop_session="));

    const sessionCount = await queryFirst<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM sessions WHERE user_id = ?",
      ["user_2"]
    );
    assert.equal(sessionCount?.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("GET /v1/auth/me rejects requests when the Access token is invalid even if the email header is present", async () => {
  const { db, close } = await createTestD1Database();

  try {
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
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_3', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);

    const response = await app.request(
      "http://localhost/v1/auth/me",
      {
        headers: {
          "cf-access-jwt-assertion": "not.a.valid.jwt",
          "cf-access-authenticated-user-email": "mlaufhutte@venterraliving.com",
        },
      },
      env
    );

    assert.equal(response.status, 401);
  } finally {
    close();
  }
});

test("GET /v1/auth/access-bootstrap returns the browser to the requesting frontend origin", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
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
      `INSERT INTO users (id, email, full_name, role, is_active, created_at, updated_at)
       VALUES ('user_4', 'mlaufhutte@venterraliving.com', 'Mark', 'admin', 1, datetime('now'), datetime('now'))`
    );

    const env = createPlatformRouteEnv(db);
    const teamDomain = "https://bootstrap-test.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      commonName: "mlaufhutte@venterraliving.com",
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
      "https://api.venterradev.com/v1/auth/access-bootstrap?next=%2F%3Fcf_bootstrapped%3D1",
      {
        headers: {
          referer: "https://app.venterraliving.com/login",
          "cf-access-jwt-assertion": token,
          "cf-access-authenticated-user-email": "mlaufhutte@venterraliving.com",
        },
        redirect: "manual",
      },
      env
    );

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "https://app.venterraliving.com/?cf_bootstrapped=1");

    const setCookie = response.headers.get("Set-Cookie");
    assert.ok(setCookie?.includes("pop_session="));
    assert.ok(setCookie?.includes("Domain=.venterraliving.com"));
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("GET /v1/auth/me auto-provisions a viewer from Cloudflare Access when enabled", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
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
      `CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT NOT NULL
      )`
    );

    const env = createPlatformRouteEnv(db);
    env.CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED = "true";
    env.CLOUDFLARE_ACCESS_DEFAULT_ROLE = "viewer";
    const teamDomain = "https://viewer-auto-provision.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
      commonName: "Observer User",
      email: "observer@venterraliving.com",
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
          "cf-access-authenticated-user-email": "observer@venterraliving.com",
        },
      },
      env
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.user.email, "observer@venterraliving.com");
    assert.equal(payload.user.role, "viewer");
    assert.equal(payload.bootstrap, "cloudflare_access");

    const user = await queryFirst<{ email: string; role: string; is_active: number }>(
      db,
      "SELECT email, role, is_active FROM users WHERE email = ?",
      ["observer@venterraliving.com"]
    );
    assert.equal(user?.email, "observer@venterraliving.com");
    assert.equal(user?.role, "viewer");
    assert.equal(user?.is_active, 1);

    const auditRow = await queryFirst<{ action: string }>(
      db,
      "SELECT action FROM audit_log WHERE entity_type = 'user' AND action = 'user.auto_provision'"
    );
    assert.equal(auditRow?.action, "user.auto_provision");
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test("GET /v1/auth/me auto-provisions an admin when the Access email is explicitly elevated", async () => {
  const { db, close } = await createTestD1Database();
  const originalFetch = globalThis.fetch;

  try {
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
      `CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT NOT NULL
      )`
    );

    const env = createPlatformRouteEnv(db);
    env.CLOUDFLARE_ACCESS_AUTO_PROVISION_ENABLED = "true";
    env.CLOUDFLARE_ACCESS_ADMIN_EMAILS = "mlaufhutte@venterraliving.com";
    const teamDomain = "https://admin-auto-provision.cloudflareaccess.com";
    env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = teamDomain;
    const { token, jwk } = buildCloudflareAccessJwt({
      teamDomain,
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
    assert.equal(payload.user.role, "admin");

    const user = await queryFirst<{ role: string }>(
      db,
      "SELECT role FROM users WHERE email = ?",
      ["mlaufhutte@venterraliving.com"]
    );
    assert.equal(user?.role, "admin");
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});
