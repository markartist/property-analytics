import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/index";
import { hashToken } from "../../src/lib/crypto";
import { run } from "../../src/lib/db";
import { ensureCaptainRuntimeTables } from "../../src/platform/captain/runtime";
import { createPlatformRouteEnv } from "../helpers/platform-route-env";
import { createTestD1Database } from "../helpers/sqlite-d1";

async function seedAuth(db: D1Database) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
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
    `CREATE TABLE IF NOT EXISTS sessions (
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
  const rawToken = Buffer.from("captain-brief-session").toString("base64url");
  const tokenHash = await hashToken(rawToken);
  const now = new Date().toISOString();
  await run(
    db,
    `INSERT OR REPLACE INTO users (id, email, full_name, role, is_active, last_login_at, created_at, updated_at)
     VALUES ('captain_admin', 'captain@example.com', 'Captain Admin', 'admin', 1, ?, ?, ?)`,
    [now, now, now]
  );
  await run(
    db,
    `INSERT OR REPLACE INTO sessions (id, user_id, session_token_hash, expires_at, revoked_at, created_at, updated_at)
     VALUES ('captain_session', 'captain_admin', ?, ?, NULL, ?, ?)`,
    [tokenHash, new Date(Date.now() + 86400000).toISOString(), now, now]
  );
  return rawToken;
}

async function seedCaptainReadTables(db: D1Database) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      external_key TEXT,
      ga4_property_id TEXT,
      encasa_property_code TEXT,
      full_url TEXT,
      unit_count INTEGER,
      deleted_at TEXT
    )`
  );
  await run(
    db,
    `INSERT OR REPLACE INTO communities (id, name, external_key, ga4_property_id, encasa_property_code, full_url, unit_count)
     VALUES ('community_ar4pb', 'The Pointe Bentonville', '482958962', '482958962', 'AR4PB', 'https://example.com', 452)`
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS governed_memory_entries (
      id TEXT PRIMARY KEY,
      property_id TEXT,
      summary TEXT,
      structured_payload_json TEXT,
      created_at TEXT
    )`
  );
  await run(
    db,
    `INSERT OR REPLACE INTO governed_memory_entries (id, property_id, summary, structured_payload_json, created_at)
     VALUES ('mem_test', 'community_ar4pb', 'Demand exists; inventory pressure is the issue.', '{"captain":"Captain Benton"}', '2026-04-25T00:00:00Z')`
  );
  await ensureCaptainRuntimeTables(db);
  await run(
    db,
    `CREATE TABLE guest_card_metrics (property_code TEXT, run_date TEXT, gc_this_period INTEGER, apps_this_period INTEGER)`
  );
  await run(db, `CREATE TABLE ga4_daily_metrics (property_id TEXT, metric_date TEXT)`);
  await run(db, `CREATE TABLE gsc_daily_metrics (community_id TEXT, metric_date TEXT)`);
  await run(db, `CREATE TABLE google_ads_campaigns (property_id TEXT, metric_date TEXT, campaign_status TEXT, campaign_name TEXT)`);
  await run(db, `CREATE TABLE pagespeed_metrics (property_id TEXT, metric_date TEXT)`);
  await run(db, `CREATE TABLE gbp_daily_insights (property_id TEXT, metric_date TEXT)`);
  await run(
    db,
    `CREATE TABLE marketing_bi_daily_packets (
      id TEXT PRIMARY KEY,
      report_date TEXT,
      selected_period_start TEXT,
      selected_period_end TEXT,
      page_count INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_bi_property_summary_rows (
      id TEXT PRIMARY KEY,
      packet_id TEXT,
      report_date TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      apartments INTEGER,
      acquired_date TEXT,
      year_built INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_ops_summary_rows (
      report_date TEXT,
      source_as_of_date TEXT,
      region TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      units INTEGER,
      occupancy REAL,
      atr30 REAL,
      atr REAL,
      leads_t30_py INTEGER,
      leads_t30 INTEGER,
      leads_t30_var REAL,
      leads_t7_py INTEGER,
      leads_t7 INTEGER,
      leads_t7_var REAL,
      visits_t30_py INTEGER,
      visits_t30 INTEGER,
      visits_t30_var REAL,
      visits_t7_py INTEGER,
      visits_t7 INTEGER,
      visits_t7_var REAL,
      leases_t7_py INTEGER,
      leases_t7 INTEGER,
      close_ratio REAL,
      projected_traffic_gap REAL,
      ad_spend_t1_budget REAL,
      ad_spend_t1_actual REAL,
      ad_spend_t1_var REAL,
      kingsley_find_property_avg_t30 REAL,
      kingsley_find_property_py_avg_t30 REAL
    )`
  );
  await run(
    db,
    `CREATE TABLE available_unit_interest_metrics (
      report_date TEXT,
      location TEXT,
      property_id TEXT,
      community_id TEXT,
      available_units INTEGER,
      vacant_available_units INTEGER,
      notice_available_units INTEGER,
      t7_guest_cards_vol INTEGER,
      t7_guest_cards_per_available_unit REAL,
      t30_guest_cards_vol INTEGER,
      t30_guest_cards_per_available_unit REAL,
      t7_prospect_quote_vol INTEGER,
      t30_prospect_quote_vol INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_traffic_conversions (
      report_date TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      guest_cards_t7 INTEGER,
      guest_cards_t7_yoy REAL,
      guest_cards_t30 INTEGER,
      guest_cards_t30_yoy REAL,
      guest_cards_t60 INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_cancel_denial_by_source (
      report_date TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      cancel_denial_type TEXT,
      cancel_denial_reason TEXT,
      marketing_source TEXT,
      cancel_denial_count INTEGER,
      applications INTEGER,
      guest_cards INTEGER
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_bi_cost_per_conversion_rows (
      id TEXT PRIMARY KEY,
      report_date TEXT,
      calendar_month TEXT,
      region TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      marketing_source_group TEXT,
      marketing_source_desc TEXT,
      cost_per_guest_card REAL,
      cost_per_visit REAL,
      cost_per_application REAL,
      cost_per_lease REAL,
      invalid_value_count INTEGER,
      source_file TEXT,
      evidence_json TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE marketing_bi_ad_spend_performance_month (
      id TEXT PRIMARY KEY,
      report_date TEXT,
      calendar_month TEXT,
      region TEXT,
      property_name TEXT,
      property_id TEXT,
      community_id TEXT,
      guest_cards INTEGER,
      visits INTEGER,
      leases INTEGER,
      ad_spend_total REAL,
      ad_spend_delta REAL,
      source_file TEXT,
      evidence_json TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE competitor_market_research_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT,
      captured_at TEXT,
      property_id TEXT,
      community_id TEXT,
      property_name TEXT,
      market_name TEXT,
      research_scope TEXT,
      source_file TEXT,
      source_author TEXT,
      notes TEXT,
      evidence_json TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE competitor_market_research_observations (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT,
      snapshot_date TEXT,
      captured_at TEXT,
      property_id TEXT,
      community_id TEXT,
      subject_property_name TEXT,
      competitor_name TEXT,
      competitor_url TEXT,
      source_name TEXT,
      source_url TEXT,
      source_type TEXT,
      evidence_category TEXT,
      captured_date TEXT,
      floorplan_name TEXT,
      bedroom_count REAL,
      bathroom_count REAL,
      sqft_min INTEGER,
      sqft_max INTEGER,
      rent_min REAL,
      rent_max REAL,
      availability_status TEXT,
      special_text TEXT,
      rating REAL,
      review_count INTEGER,
      package_indicator TEXT,
      media_indicators_json TEXT,
      usp_text TEXT,
      raw_claim TEXT,
      confidence TEXT,
      source_freshness_label TEXT,
      evidence_json TEXT
    )`
  );
  await run(
    db,
    `CREATE TABLE unit_availability_units (
      snapshot_date TEXT,
      property_id TEXT,
      floorplan_name TEXT,
      unit_id TEXT,
      building TEXT,
      apt_number TEXT,
      rent_from REAL,
      rent_to REAL,
      moved_out_date TEXT,
      available_date TEXT,
      pricing_and_specials_message TEXT,
      concession_amount REAL
    )`
  );
  await run(db, `INSERT INTO guest_card_metrics VALUES ('AR4PB', '2026-04-24', 137, 34)`);
  await run(db, `INSERT INTO ga4_daily_metrics VALUES ('482958962', '2026-04-24')`);
  await run(db, `INSERT INTO gsc_daily_metrics VALUES ('community_ar4pb', '2026-04-22')`);
  await run(db, `INSERT INTO google_ads_campaigns VALUES ('482958962', '2026-03-20', 'PAUSED', 'Pointe PPC')`);
  await run(db, `INSERT INTO pagespeed_metrics VALUES ('482958962', '2026-04-25')`);
  await run(db, `INSERT INTO gbp_daily_insights VALUES ('482958962', '2026-04-23')`);
  await run(db, `INSERT INTO marketing_bi_daily_packets VALUES ('packet_1', '2026-04-27', '2026-01-28', '2026-04-27', 31)`);
  await run(db, `INSERT INTO marketing_bi_property_summary_rows VALUES ('summary_1', 'packet_1', '2026-04-27', 'Pointe', 'AR4PB', 'community_ar4pb', 452, '2025-04-15', 2021)`);
  await run(
    db,
    `INSERT INTO marketing_ops_summary_rows VALUES
     ('2026-05-04', '2026-05-03', 'Arkansas', 'Pointe', 'AR4PB', 'community_ar4pb', 452, 0.905, 0.084, 0.11, 71, 166, 1.338, 37, 40, 0.081, 70, 90, 0.286, 12, 18, 0.5, 20, 22, 0.047, -30.5, 1500, 1800, 0.2, 0.92, 0.94),
     ('2026-05-04', '2026-05-03', 'Arkansas', 'Stronger Peer', 'AR4SP', 'community_peer', 452, 0.955, 0.02, 0.04, 80, 180, 0.22, 40, 45, 0.125, 75, 95, 0.267, 15, 24, 0.6, 24, 28, 0.08, 10, 1500, 1400, -0.067, 0.96, 0.95)`
  );
  await run(db, `INSERT INTO available_unit_interest_metrics VALUES ('2026-04-27', 'Pointe', 'AR4PB', 'community_ar4pb', 55, 37, 18, 40, 0.7, 166, 3.0, 96, 316)`);
  await run(db, `INSERT INTO marketing_traffic_conversions VALUES ('2026-04-27', 'Pointe', 'AR4PB', 'community_ar4pb', 40, 0.081, 166, 1.338, 307)`);
  await run(
    db,
    `INSERT INTO marketing_cancel_denial_by_source VALUES
     ('2026-04-27', 'Pointe', 'AR4PB', 'community_ar4pb', 'Cancel', 'Abandoned', 'Website', 2, 82, 61),
     ('2026-04-27', 'Pointe', 'AR4PB', 'community_ar4pb', 'Denial', 'Failed Credit or Criminal', 'Google Ads', 1, 4, 4)`
  );
  await run(
    db,
    `INSERT INTO marketing_bi_cost_per_conversion_rows VALUES
     ('cpc_apt', '2026-04-29', NULL, 'Arkansas', 'Pointe', 'AR4PB', 'community_ar4pb', 'Apartments.com', 'Apartments.com', 70.88, 120, 273.42, 319.0, 0, 'Cost Per Conversion.xlsx', NULL),
     ('cpc_google', '2026-04-29', NULL, 'Arkansas', 'Pointe', 'AR4PB', 'community_ar4pb', 'Google Ads', 'Google Ads', 218.21, 500, 1003.8, 2509.5, 0, 'Cost Per Conversion.xlsx', NULL)`
  );
  await run(
    db,
    `INSERT INTO marketing_bi_ad_spend_performance_month VALUES
     ('spend_mar', '2026-04-30', '2026-03-01', 'Arkansas', 'Pointe', 'AR4PB', 'community_ar4pb', 50, 20, 4, 3438, -0.08, 'Ad Spend Performance.xlsx', NULL)`
  );
  await run(
    db,
    `INSERT INTO competitor_market_research_snapshots VALUES
     ('comp_snapshot', '2026-05-05', '2026-05-05T12:00:00-05:00', 'AR4PB', 'community_ar4pb', 'The Pointe Bentonville', 'Bentonville, AR', 'initial_spotlight_competitor_slice', 'manual.json', 'Codex', NULL, NULL)`
  );
  await run(
    db,
    `INSERT INTO competitor_market_research_observations VALUES
     ('comp_subject', 'comp_snapshot', '2026-05-05', '2026-05-05T12:00:00-05:00', 'AR4PB', 'community_ar4pb', 'The Pointe Bentonville', 'The Pointe Bentonville', 'https://venterraliving.com', 'Official', 'https://venterraliving.com', 'official_property_page', 'subject_position', '2026-05-05', NULL, 1, 1, 900, NULL, 1329, NULL, 'visible', NULL, NULL, NULL, NULL, NULL, 'Large 1BR, furnished, short-term, Walmart proximity.', 'The Pointe visible 1BR starts at $1329.', 'confirmed', 'captured_today', NULL),
     ('comp_rent', 'comp_snapshot', '2026-05-05', '2026-05-05T12:00:00-05:00', 'AR4PB', 'community_ar4pb', 'The Pointe Bentonville', 'The Trails at Bentonville', 'https://trails.example.com', 'Trails official', 'https://trails.example.com/floorplans', 'official_competitor_page', 'rent', '2026-05-05', 'A1', 1, 1, 544, 1093, 965, 1170, 'visible', NULL, NULL, NULL, NULL, NULL, NULL, 'The Trails visible 1BR rents at $965.', 'confirmed', 'captured_today', NULL),
     ('comp_special', 'comp_snapshot', '2026-05-05', '2026-05-05T12:00:00-05:00', 'AR4PB', 'community_ar4pb', 'The Pointe Bentonville', 'The Trails at Bentonville', 'https://trails.example.com', 'Trails official', 'https://trails.example.com/floorplans', 'official_competitor_page', 'special', '2026-05-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '$175 off per month', NULL, NULL, NULL, NULL, NULL, 'The Trails shows $175 off per month.', 'confirmed', 'captured_today', NULL),
     ('comp_gap', 'comp_snapshot', '2026-05-05', '2026-05-05T12:00:00-05:00', 'AR4PB', 'community_ar4pb', 'The Pointe Bentonville', 'Competitive Research', 'https://apartments.com', 'Research gap', 'https://apartments.com', 'source_gap', 'source_gap', '2026-05-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'package gap', NULL, NULL, 'ADC package status requires controlled source.', 'missing', 'needs_source', NULL)`
  );
  await run(
    db,
    `INSERT INTO unit_availability_units
     VALUES
     ('2026-04-25', '482958962', 'A1', 'unit_a', '1', '101', 1329, 1382, '2025-04-20', '2026-04-25', 'Up to 2 months'' rent free on select units', 3000),
     ('2026-04-25', '482958962', 'B1', 'unit_b', '2', '202', 1537, 1590, '2026-02-01', '2026-04-25', 'Up to 1 month''s rent free on select units', 1500)`
  );
  await run(
    db,
    `INSERT INTO captain_watch_items
     (id, property_id, community_id, watch_key, title, category, severity, status, current_state, evidence_json, next_move, owner_role, source_agent_key, first_seen_at, last_seen_at, created_at, updated_at)
     VALUES
     ('watch_AR4PB_aged_365_units', 'AR4PB', 'community_ar4pb', 'aged_365_units', '365+ day unit validation', 'inventory', 'critical', 'open', '1 unit needs classification.', '{}', 'Classify unit.', 'Property', 'benton_inventory_watch', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'),
     ('watch_AR4PB_source_freshness', 'AR4PB', 'community_ar4pb', 'source_freshness', 'Source freshness', 'source_intake', 'medium', 'resolved', 'Resolved.', '{}', NULL, 'Data Pond', 'benton_source_scout', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z')`
  );
  await run(
    db,
    `INSERT INTO captain_actions
     (id, property_id, community_id, action_key, title, owner_role, status, priority, evidence_json, source_agent_key, created_at, updated_at)
     VALUES ('action_AR4PB_classify_365_day_units', 'AR4PB', 'community_ar4pb', 'classify_365_day_units', 'Classify 365+ day units', 'Property', 'open', 'critical', '{}', 'benton_inventory_watch', '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z')`
  );
  await run(
    db,
    `INSERT INTO captain_agent_runs
     (id, property_id, community_id, agent_key, run_type, run_status, started_at, finished_at, findings_json, metrics_json, exceptions_json, created_at)
     VALUES ('captain_run_test', 'AR4PB', 'community_ar4pb', 'benton_supervisor_scribe', 'manual', 'success', '2026-04-25T00:00:00Z', '2026-04-25T00:01:00Z', '{}', '{}', '[]', '2026-04-25T00:01:00Z')`
  );
  await run(
    db,
    `INSERT INTO captain_brief_runs
     (id, property_id, community_id, run_status, brief_type, period_start, period_end, memory_entry_id, summary, payload_json, created_at, updated_at)
     VALUES
     ('captain_brief_AR4PB_test', 'AR4PB', 'community_ar4pb', 'draft', 'captain_brief', '2026-03-26', '2026-04-25', 'mem_test', 'Demand exists; inventory pressure is the issue.', '{"latestMemory":{"structured_payload_json":"{\\"captain\\":\\"Captain Benton\\"}"}}', '2026-04-25T00:02:00Z', '2026-04-25T00:02:00Z')`
  );
}

test("latest Captain Brief read returns source readiness and unit-number aged inventory", async () => {
  const { db, close } = await createTestD1Database();
  try {
    const session = await seedAuth(db);
    await seedCaptainReadTables(db);
    const env = createPlatformRouteEnv(db);

    const response = await app.fetch(
      new Request("http://localhost/v1/captain/properties/AR4PB/brief/latest", {
        headers: { cookie: `pop_session=${session}` },
      }),
      env
    );

    if (response.status !== 200) {
      assert.fail(await response.text());
    }
    const json = await response.json();
    assert.equal(json.propertyCode, "AR4PB");
    assert.equal(json.captainName, "Captain Benton");
    assert.equal(json.sources.googleAdsPosture, "paused_no_current_activity");
    assert.equal(json.sources.marketingBiPacket, "2026-04-27");
    assert.equal(json.sources.marketingOpsSummary, "2026-05-04");
    assert.equal(json.sources.competitorMarketResearch, "2026-05-05");
    assert.equal(json.operatingSnapshot.status, "missing_source");
    assert.equal(json.operatingSnapshot.sourceNeeded, "property_operating_metrics");
    assert.equal(json.marketingInsight.status, "grounded");
    assert.equal(json.marketingInsight.opsRead.metrics.leadsT30, 166);
    assert.equal(json.marketingInsight.opsRead.posture, "traffic_gap");
    assert.equal(json.marketingInsight.conversionRead.metrics.t30GuestCards, 166);
    assert.equal(json.marketingInsight.conversionRead.metrics.availableUnits, 55);
    assert.equal(json.marketingInsight.sourceSpendRead.bestSources.lease.sourceGroup, "Apartments.com / ADC");
    assert.equal(json.marketingInsight.sourceSpendRead.metrics.latestAdSpendTotal, 3438);
    assert.equal(json.competitorMarketRead.status, "grounded");
    assert.equal(json.competitorMarketRead.counts.competitors, 1);
    assert.equal(json.competitorMarketRead.subject.rentMin, 1329);
    assert.equal(json.competitorMarketRead.subject.rentMax, 1590);
    assert.deepEqual(
      [...json.competitorMarketRead.subject.visibleSpecials].sort(),
      ["Up to 1 month's rent free on select units", "Up to 2 months' rent free on select units"]
    );
    assert.equal(json.competitorMarketRead.pricingPressure.posture, "visible_value_pressure");
    assert.equal(json.competitorMarketRead.pricingPressure.subjectRentMin, 1329);
    assert.equal(json.competitorMarketRead.pricingPressure.lowerRentCompetitors[0].competitorName, "The Trails at Bentonville");
    assert.equal(json.competitorMarketRead.decision.pricing, "review");
    assert.equal(json.competitorMarketRead.decision.advertising, "do_not_broadly_increase_until_value_position_is_reviewed");
    assert.match(json.competitorMarketRead.decisionSummary, /Our visible starting rent is \$1,329/);
    assert.equal(json.competitorMarketRead.evidenceReferences[0].id, "CM-1");
    assert.equal(json.competitorMarketRead.evidenceReferences[0].source, "unit_availability_units");
    assert.ok(json.competitorMarketRead.why.some((item: Record<string, unknown>) => String(item.statement).includes("Pricing and concession review")));
    assert.match(json.competitorMarketRead.stephanieAnswers.packageStatus, /not confirmed/);
    assert.equal(json.marketingInsight.cancelDenial.topReasons[0].reason, "Abandoned");
    assert.match(json.marketingInsight.narrative, /Web Ops Summary shows 166 T30 leads/);
    assert.equal(json.diagnosticRead.primaryConstraint, "inventory");
    assert.equal(json.diagnosticRead.confidence, "medium");
    assert.equal(json.diagnosticRead.recoveryMath.availableUnits, 55);
    assert.equal(json.diagnosticRead.recoveryMath.targetAvailableUnits, 45);
    assert.equal(json.diagnosticRead.recoveryMath.moveInsNeeded, 10);
    assert.equal(json.diagnosticRead.recoveryMath.guestCardsNeededAtCurrentClose, 213);
    assert.equal(json.diagnosticRead.sourceSpendDiagnosis.bestSources.lease.sourceGroup, "Apartments.com / ADC");
    assert.equal(json.diagnosticRead.competitorMarketRead.pricingPressure.posture, "visible_value_pressure");
    assert.ok(json.diagnosticRead.recommendations.some((item: Record<string, unknown>) => item.constraint === "competitive_market"));
    assert.ok(json.diagnosticRead.doNotRecommend.some((gate: string) => gate.includes("ADC/package")));
    assert.equal(json.diagnosticRead.designationDoctrine.captainPosture, "monitor_and_remember");
    assert.equal(json.diagnosticRead.peerFamilyRead.status, "derived");
    assert.equal(json.diagnosticRead.peerFamilyRead.peerSet[0].propertyCode, "AR4SP");
    assert.equal(json.diagnosticRead.recommendations[0].constraint, "inventory");
    assert.ok(json.diagnosticRead.doNotRecommend.some((gate: string) => gate.includes("more advertising spend")));
    assert.equal(json.activeWatchItems.length, 1);
    assert.equal(json.resolvedSourceItems.length, 1);
    assert.equal(json.inventory.buckets.aged365, 1);
    assert.equal(json.inventory.agedUnits[0].apt_number, "101");
    assert.equal(json.inventory.agedUnits[0].floorplan_name, "A1");
  } finally {
    close();
  }
});
