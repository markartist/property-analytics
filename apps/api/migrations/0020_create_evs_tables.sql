-- Migration 0020: Experience Validation Service (EVS)
-- Shared validation service with staging-first pilot properties, request history,
-- and normalized result persistence for Property Advocate and future consumers.

CREATE TABLE IF NOT EXISTS evs_properties (
  id TEXT PRIMARY KEY,
  property_name TEXT NOT NULL,
  community_id TEXT REFERENCES communities(id),
  legacy_url TEXT,
  staging_url TEXT NOT NULL,
  cohort TEXT NOT NULL CHECK (cohort IN ('pilot')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evs_requests (
  id TEXT PRIMARY KEY,
  source_consumer TEXT NOT NULL CHECK (source_consumer IN ('property_advocate', 'deploy_pipeline', 'governance_audit', 'operator')),
  property_id TEXT NOT NULL REFERENCES evs_properties(id),
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'prod')),
  reason TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_pages_json TEXT NOT NULL,
  validation_profiles_json TEXT NOT NULL,
  device_profiles_json TEXT NOT NULL,
  governance_context_json TEXT,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('manual', 'post_deploy', 'scheduled')),
  trigger_metadata_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  provider TEXT NOT NULL CHECK (provider IN ('browserstack')),
  requested_by TEXT,
  orchestrator_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_requests_property_created
  ON evs_requests(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evs_requests_status
  ON evs_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS evs_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES evs_requests(id),
  property_id TEXT NOT NULL REFERENCES evs_properties(id),
  profile TEXT NOT NULL CHECK (profile IN ('broad_experiential_homepage', 'critical_cta_smoke', 'header_navigation_integrity', 'portfolio_functionality_regression', 'apartments_pricing_deep_journey', 'apartments_pricing_mobile_journey', 'contact_form_checks', 'lead_attribution_e2e')),
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'prod')),
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  summary TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  business_impact TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  normalized_payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_results_property_created
  ON evs_results(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evs_results_request_created
  ON evs_results(request_id, created_at DESC);

INSERT OR IGNORE INTO evs_properties (
  id, property_name, community_id, legacy_url, staging_url, cohort, is_active, created_at, updated_at
) VALUES
  (
    'champions-green',
    'Champion''s Green',
    (SELECT id FROM communities WHERE name = 'Champion''s Green' LIMIT 1),
    'https://venterraliving.com/apartments/champions-green/',
    'https://championsgreen.kinsta.cloud/',
    'pilot',
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'the-district-universal',
    'The District Universal',
    (SELECT id FROM communities WHERE name = 'The District Universal' LIMIT 1),
    'https://venterraliving.com/apartments/the-district-universal-boulevard/',
    'https://thedistrictuniversalboulevard.kinsta.cloud/',
    'pilot',
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'the-harrison',
    'The Harrison',
    (SELECT id FROM communities WHERE name = 'The Harrison' LIMIT 1),
    'https://venterraliving.com/apartments/the-harrison/',
    'https://theharrison.kinsta.cloud/',
    'pilot',
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'ventana',
    'Ventana',
    (SELECT id FROM communities WHERE name = 'Ventana' LIMIT 1),
    'https://venterraliving.com/apartments/ventana/',
    'https://ventana.kinsta.cloud/',
    'pilot',
    1,
    datetime('now'),
    datetime('now')
  ),
  (
    'calais-midtown',
    'Calais Midtown',
    (SELECT id FROM communities WHERE name = 'Calais Midtown' LIMIT 1),
    'https://venterraliving.com/apartments/calais-midtown/',
    'https://calaismidtown.kinsta.cloud/',
    'pilot',
    1,
    datetime('now'),
    datetime('now')
  );
