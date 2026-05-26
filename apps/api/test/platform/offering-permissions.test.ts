import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { run } from "../../src/lib/db";
import { createTestD1Database } from "../helpers/sqlite-d1";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";

async function seedAuth(db: D1Database) {
  await run(
    db,
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT
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
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )`
  );
}

async function createSession(db: D1Database, role: "admin" | "editor" | "viewer", userId: string) {
  const rawToken = Buffer.from(`${userId}-offering-permissions-session`).toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT INTO users (id, email, full_name, role, is_active, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    [userId, `${userId}@example.com`, userId, role, now, now, now]
  );
  await run(
    db,
    `INSERT INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [`session_${userId}`, userId, tokenHash, new Date(Date.now() + 86400000).toISOString(), now, now]
  );
  return rawToken;
}

async function requestWithSession(
  env: ReturnType<typeof createPlatformRouteEnv>,
  rawToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {}
) {
  return app.request(
    `http://localhost${path}`,
    {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        cookie: `pop_session=${rawToken}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env
  );
}

test("observer cannot open steward-only site content or intelligence surfaces through API routes", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    const viewerToken = await createSession(db, "viewer", "viewer_guarded");
    const env = createPlatformRouteEnv(db);

    const siteContentResponse = await requestWithSession(env, viewerToken, "/v1/admin/site-content");
    assert.equal(siteContentResponse.status, 403);
    const siteContentJson = await siteContentResponse.json();
    assert.match(siteContentJson.error.message, /siteContent:view/);

    const intelligenceResponse = await requestWithSession(env, viewerToken, "/v1/admin/intelligence");
    assert.equal(intelligenceResponse.status, 403);
    const intelligenceJson = await intelligenceResponse.json();
    assert.match(intelligenceJson.error.message, /intelligenceOffice:view/);
  } finally {
    close();
  }
});

test("observer cannot open steward-only admin user controls through API routes", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    const viewerToken = await createSession(db, "viewer", "viewer_admin");
    const env = createPlatformRouteEnv(db);

    const response = await requestWithSession(env, viewerToken, "/v1/admin/users");
    assert.equal(response.status, 403);
    const json = await response.json();
    assert.match(json.error.message, /adminUsers:view/);
  } finally {
    close();
  }
});
