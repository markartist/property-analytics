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
  const rawToken = Buffer.from(`${userId}-site-content-session`).toString("base64url");
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

test("site content property route returns Specs section mappings for captured homepage sections", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    const adminToken = await createSession(db, "admin", "admin_site_content");
    const env = createPlatformRouteEnv(db);

    const boot = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(boot.status, 200);

    const inventoryBoot = await requestWithSession(env, adminToken, "/v1/admin/site-content");
    assert.equal(inventoryBoot.status, 200);

    await run(
      db,
      `INSERT INTO site_content_pages
       (id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "page_home_1",
        "calais-midtown",
        "https://calaismidtownapartments.com/",
        "/",
        "homepage",
        "Calais Midtown Apartments",
        "Calais Midtown homepage",
        "ready",
        "2026-04-16T00:00:00.000Z",
        "2026-04-16T00:00:00.000Z",
      ]
    );

    await run(
      db,
      `INSERT INTO site_content_sections
       (id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "section_home_hero",
        "page_home_1",
        "hero",
        0,
        "Welcome Home",
        "Calais Midtown Apartments in Houston",
        null,
        "Calais Midtown Apartments in Houston",
        null,
        "standard",
        "right",
        "Welcome to Calais Midtown Apartments in Houston where modern living, Midtown access, and daily convenience come together.",
        JSON.stringify([]),
        1,
        2,
        "2026-04-16T00:00:00.000Z",
      ]
    );

    await run(
      db,
      `INSERT INTO site_content_sections
       (id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "section_home_amenities",
        "page_home_1",
        "community-amenities",
        1,
        "Community Amenities",
        "Community Amenities",
        null,
        "Community Amenities",
        null,
        "amenities",
        "left",
        "Explore resort-style amenities including a pool, fitness center, lounge spaces, and pet-friendly convenience built into daily life.",
        JSON.stringify(["Resort-style pool", "Fitness center"]),
        1,
        3,
        "2026-04-16T00:00:00.000Z",
      ]
    );

    const response = await requestWithSession(env, adminToken, "/v1/admin/site-content/calais-midtown");
    assert.equal(response.status, 200);
    const json = await response.json();
    const homepage = json.pages.find((page: any) => page.page_type === "homepage");
    assert.ok(homepage);
    assert.ok(Array.isArray(homepage.section_mappings));
    assert.ok(Array.isArray(homepage.section_assessments));
    assert.ok(homepage.section_mappings.some((mapping: any) => mapping.expected_section_key === "hero"));
    assert.ok(homepage.section_mappings.some((mapping: any) => mapping.match_status === "missing-from-live"));
    assert.ok(homepage.section_mapping_summary.matched >= 1);
    assert.ok(homepage.section_assessments.some((assessment: any) => assessment.overall_status));
    assert.ok(homepage.section_assessment_summary.watch >= 0);
    assert.ok(Array.isArray(homepage.section_rewrites));
    assert.ok(homepage.section_rewrites.some((rewrite: any) => rewrite.draft_status === "not_started"));
    assert.ok(homepage.section_rewrite_summary.not_started >= 1);
  } finally {
    close();
  }
});

test("site content rewrite route persists editorial draft state for a mapped section", async () => {
  const { db, close } = await createTestD1Database();
  try {
    await seedAuth(db);
    const adminToken = await createSession(db, "admin", "admin_site_content_rewrite");
    const env = createPlatformRouteEnv(db);

    const boot = await requestWithSession(env, adminToken, "/v1/admin/intelligence");
    assert.equal(boot.status, 200);

    const inventoryBoot = await requestWithSession(env, adminToken, "/v1/admin/site-content");
    assert.equal(inventoryBoot.status, 200);

    await run(
      db,
      `INSERT INTO site_content_pages
       (id, property_id, page_url, page_path, page_type, page_title, meta_description, crawl_status, crawled_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "page_home_rewrite",
        "calais-midtown",
        "https://calaismidtownapartments.com/",
        "/",
        "homepage",
        "Calais Midtown Apartments",
        "Calais Midtown homepage",
        "ready",
        "2026-04-16T00:00:00.000Z",
        "2026-04-16T00:00:00.000Z",
      ]
    );

    await run(
      db,
      `INSERT INTO site_content_sections
       (id, page_id, section_key, section_order, section_label, heading, eyebrow, title, subtitle, section_type, media_side, original_copy, bullet_points_json, image_count, link_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "section_home_rewrite",
        "page_home_rewrite",
        "hero",
        0,
        "Welcome Home",
        "Calais Midtown Apartments in Houston",
        null,
        "Calais Midtown Apartments in Houston",
        null,
        "standard",
        "right",
        "Welcome to Calais Midtown Apartments in Houston where modern living, Midtown access, and daily convenience come together.",
        JSON.stringify([]),
        1,
        2,
        "2026-04-16T00:00:00.000Z",
      ]
    );

    const firstDetail = await requestWithSession(env, adminToken, "/v1/admin/site-content/calais-midtown");
    assert.equal(firstDetail.status, 200);
    const firstJson = await firstDetail.json();
    const homepage = firstJson.pages.find((page: any) => page.id === "page_home_rewrite");
    assert.ok(homepage);
    const heroMapping = homepage.section_mappings.find((mapping: any) => mapping.expected_section_key === "hero");
    assert.ok(heroMapping);

    const saveResponse = await requestWithSession(env, adminToken, "/v1/admin/site-content/calais-midtown/rewrite", {
      method: "PATCH",
      body: {
        page_id: "page_home_rewrite",
        mapping_id: heroMapping.id,
        section_id: "section_home_rewrite",
        draft_status: "approved",
        rewrite_brief: "Rewrite the homepage hero with stronger Midtown specificity.",
        proposed_copy: "Find your rhythm at Calais Midtown, where connected Houston living meets polished apartment comfort.",
        refinement_notes: "Keep the tone modern and location-specific.",
      },
    });
    assert.equal(saveResponse.status, 200);
    const savedJson = await saveResponse.json();
    assert.equal(savedJson.rewrite.draft_status, "approved");
    assert.ok(savedJson.rewrite.approved_at);
    assert.equal(savedJson.rewrite.approved_by, "admin_site_content_rewrite");

    const secondDetail = await requestWithSession(env, adminToken, "/v1/admin/site-content/calais-midtown");
    assert.equal(secondDetail.status, 200);
    const secondJson = await secondDetail.json();
    const updatedHomepage = secondJson.pages.find((page: any) => page.id === "page_home_rewrite");
    assert.ok(updatedHomepage);
    const savedRewrite = updatedHomepage.section_rewrites.find((rewrite: any) => rewrite.mapping_id === heroMapping.id);
    assert.ok(savedRewrite);
    assert.equal(savedRewrite.proposed_copy, "Find your rhythm at Calais Midtown, where connected Houston living meets polished apartment comfort.");
    assert.equal(savedRewrite.draft_status, "approved");
    assert.equal(updatedHomepage.section_rewrite_summary.approved, 1);
  } finally {
    close();
  }
});
