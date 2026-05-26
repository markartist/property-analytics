-- Migration 0039: Edge Experimentation System
-- Governed Data Pond experiment definitions, variants, telemetry, guardrails, decisions, and learnings.

CREATE TABLE IF NOT EXISTS edge_experiments (
  experiment_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT,
  status TEXT NOT NULL,
  property_code TEXT NOT NULL,
  community_id TEXT,
  website_host TEXT,
  page_type TEXT NOT NULL,
  page_path TEXT NOT NULL,
  component_id TEXT NOT NULL,
  component_contract_source TEXT NOT NULL,
  change_type TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  guardrail_policy_id TEXT NOT NULL,
  traffic_split_pct INTEGER NOT NULL DEFAULT 50,
  assignment_unit TEXT NOT NULL DEFAULT 'anonymous_visitor',
  rollback_owner TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  scheduled_start_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  decision TEXT,
  decision_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_edge_experiments_status
  ON edge_experiments(status);

CREATE INDEX IF NOT EXISTS idx_edge_experiments_property
  ON edge_experiments(property_code, community_id);

CREATE INDEX IF NOT EXISTS idx_edge_experiments_page_component
  ON edge_experiments(page_type, page_path, component_id);

CREATE TABLE IF NOT EXISTS edge_experiment_variants (
  variant_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  allocation_pct INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_selector TEXT NOT NULL,
  target_component_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  html_safety_hash TEXT,
  accessibility_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id),
  UNIQUE (experiment_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_variants_experiment
  ON edge_experiment_variants(experiment_id);

CREATE TABLE IF NOT EXISTS edge_experiment_component_contracts (
  component_contract_id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL,
  page_type TEXT NOT NULL,
  page_path TEXT,
  page_path_key TEXT NOT NULL DEFAULT '',
  selector TEXT NOT NULL,
  allowed_change_types_json TEXT NOT NULL,
  required_accessibility_checks_json TEXT NOT NULL,
  source TEXT NOT NULL,
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (component_id, page_type, page_path_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_component_contracts_lookup
  ON edge_experiment_component_contracts(page_type, component_id, status);

CREATE TABLE IF NOT EXISTS edge_experiment_config_versions (
  config_version_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  config_version INTEGER NOT NULL,
  config_status TEXT NOT NULL,
  config_json TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  signed_at TEXT,
  activated_at TEXT,
  deactivated_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id),
  UNIQUE (experiment_id, config_version)
);

CREATE INDEX IF NOT EXISTS idx_edge_config_active
  ON edge_experiment_config_versions(experiment_id, config_status, config_version);

CREATE TABLE IF NOT EXISTS edge_experiment_assignments (
  assignment_record_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  anonymous_assignment_id_hash TEXT NOT NULL,
  property_code TEXT NOT NULL,
  community_id TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  exposure_count INTEGER NOT NULL DEFAULT 1,
  assignment_source TEXT NOT NULL,
  config_version INTEGER,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id),
  UNIQUE (experiment_id, anonymous_assignment_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_edge_assignments_experiment_variant
  ON edge_experiment_assignments(experiment_id, variant_key);

CREATE INDEX IF NOT EXISTS idx_edge_assignments_property
  ON edge_experiment_assignments(property_code, community_id);

CREATE TABLE IF NOT EXISTS edge_experiment_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  variant_key TEXT,
  property_code TEXT NOT NULL,
  community_id TEXT,
  page_type TEXT,
  page_path TEXT,
  component_id TEXT,
  session_id_hash TEXT,
  assignment_id_hash TEXT,
  event_timestamp TEXT NOT NULL,
  source TEXT NOT NULL,
  config_version INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_events_experiment_time
  ON edge_experiment_events(experiment_id, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_edge_events_name_time
  ON edge_experiment_events(event_name, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_edge_events_property_time
  ON edge_experiment_events(property_code, event_timestamp);

CREATE TABLE IF NOT EXISTS edge_experiment_guardrail_snapshots (
  guardrail_snapshot_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  lcp_p75_ms REAL,
  inp_p75_ms REAL,
  cls_p75 REAL,
  conversion_rate REAL,
  selector_miss_rate REAL,
  worker_error_rate REAL,
  analytics_event_loss_rate REAL,
  guardrail_status TEXT NOT NULL,
  recommended_action TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_guardrails_experiment_date
  ON edge_experiment_guardrail_snapshots(experiment_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_edge_guardrails_status
  ON edge_experiment_guardrail_snapshots(guardrail_status);

CREATE TABLE IF NOT EXISTS edge_experiment_decisions (
  decision_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  decision_by TEXT NOT NULL,
  decision_at TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_summary TEXT,
  promoted_pattern_id TEXT,
  rollback_reference TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_decisions_experiment_time
  ON edge_experiment_decisions(experiment_id, decision_at);

CREATE TABLE IF NOT EXISTS edge_experiment_learnings (
  learning_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  finding TEXT NOT NULL,
  applicability TEXT,
  confidence TEXT NOT NULL,
  supporting_metrics_json TEXT,
  source_evidence_json TEXT,
  promoted_to_memory_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES edge_experiments(experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_learnings_scope_type
  ON edge_experiment_learnings(scope, pattern_type);

CREATE INDEX IF NOT EXISTS idx_edge_learnings_experiment
  ON edge_experiment_learnings(experiment_id);

INSERT OR IGNORE INTO edge_experiment_component_contracts (
  component_contract_id,
  component_id,
  page_type,
  page_path,
  page_path_key,
  selector,
  allowed_change_types_json,
  required_accessibility_checks_json,
  source,
  source_reference,
  status,
  last_verified_at,
  created_at,
  updated_at
) VALUES
  (
    'contract_property_homepage_hero_primary_cta',
    'property_homepage.hero_primary_cta',
    'property_homepage',
    NULL,
    '',
    '[data-component="hero-primary-cta"], .uk-button-primary, a[href*="schedule"]',
    '["text_swap","class_swap","href_swap","insert_adjacent"]',
    '["cta_text_present","href_safe","keyboard_focusable","mobile_visible"]',
    'approved_manual_contract',
    'EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02',
    'active',
    NULL,
    datetime('now'),
    datetime('now')
  ),
  (
    'contract_property_homepage_hero_secondary_cta',
    'property_homepage.hero_secondary_cta',
    'property_homepage',
    NULL,
    '',
    '[data-component="hero-secondary-cta"], .uk-button-secondary',
    '["text_swap","class_swap","href_swap"]',
    '["cta_text_present","href_safe","keyboard_focusable","mobile_visible"]',
    'approved_manual_contract',
    'EDGE_EXPERIMENTATION_SYSTEM_PRODUCTION_PLAN_2026-05-02',
    'active',
    NULL,
    datetime('now'),
    datetime('now')
  );
