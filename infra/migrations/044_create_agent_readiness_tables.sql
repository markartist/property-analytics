-- Agent Readiness monitor.
-- Weekly Cloudflare-side scans for agent-readiness posture, normalized into
-- the Pond D1 database with raw scanner evidence retained in R2.

CREATE TABLE IF NOT EXISTS agent_readiness_targets (
  target_id TEXT PRIMARY KEY,
  property_id TEXT,
  community_id TEXT,
  property_code TEXT,
  property_name TEXT,
  target_url TEXT NOT NULL,
  target_host TEXT NOT NULL,
  target_kind TEXT NOT NULL DEFAULT 'corporate_property_page'
    CHECK (target_kind IN ('corporate_property_page', 'resi_vanity', 'portfolio_site', 'custom')),
  source_system TEXT NOT NULL DEFAULT 'agent-readiness-monitor',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'retired')),
  cadence_days INTEGER NOT NULL DEFAULT 7,
  last_scanned_at TEXT,
  next_scan_after TEXT,
  last_scan_status TEXT,
  last_level INTEGER,
  last_level_name TEXT,
  last_result_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_targets_due
  ON agent_readiness_targets(status, next_scan_after, target_kind, property_code);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_targets_property
  ON agent_readiness_targets(property_code, community_id, target_kind);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_targets_host
  ON agent_readiness_targets(target_host, target_kind);

CREATE TABLE IF NOT EXISTS agent_readiness_runs (
  run_id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (run_type IN ('scheduled', 'manual', 'canary')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial', 'failed', 'skipped')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  target_limit INTEGER NOT NULL DEFAULT 0,
  target_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  r2_manifest_key TEXT,
  error_text TEXT,
  schema_version TEXT NOT NULL DEFAULT 'agent-readiness-monitor-v1',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_runs_started
  ON agent_readiness_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS agent_readiness_results (
  result_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  property_code TEXT,
  property_name TEXT,
  target_url TEXT NOT NULL,
  target_host TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'success'
    CHECK (scan_status IN ('success', 'failed')),
  level INTEGER,
  level_name TEXT,
  next_level INTEGER,
  next_level_name TEXT,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  total_check_count INTEGER NOT NULL DEFAULT 0,
  readiness_summary TEXT,
  robots_txt_status TEXT,
  sitemap_status TEXT,
  link_headers_status TEXT,
  dns_aid_status TEXT,
  markdown_negotiation_status TEXT,
  ai_bot_rules_status TEXT,
  content_signals_status TEXT,
  web_bot_auth_status TEXT,
  api_catalog_status TEXT,
  oauth_discovery_status TEXT,
  oauth_protected_resource_status TEXT,
  auth_md_status TEXT,
  mcp_server_card_status TEXT,
  a2a_agent_card_status TEXT,
  agent_skills_status TEXT,
  web_mcp_status TEXT,
  ard_status TEXT,
  failed_checks_json TEXT NOT NULL DEFAULT '[]',
  next_requirements_json TEXT NOT NULL DEFAULT '[]',
  summary_json TEXT NOT NULL DEFAULT '{}',
  raw_r2_key TEXT,
  error_text TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES agent_readiness_runs(run_id),
  FOREIGN KEY (target_id) REFERENCES agent_readiness_targets(target_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_results_current
  ON agent_readiness_results(is_current, target_kind, level, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_results_property
  ON agent_readiness_results(property_code, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_results_host
  ON agent_readiness_results(target_host, scanned_at DESC);

CREATE TABLE IF NOT EXISTS agent_readiness_check_results (
  check_result_id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  check_category TEXT NOT NULL,
  check_key TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  duration_ms INTEGER,
  details_json TEXT NOT NULL DEFAULT '{}',
  evidence_summary_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (result_id) REFERENCES agent_readiness_results(result_id),
  FOREIGN KEY (run_id) REFERENCES agent_readiness_runs(run_id),
  FOREIGN KEY (target_id) REFERENCES agent_readiness_targets(target_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_check_results_result
  ON agent_readiness_check_results(result_id, check_category, check_key);

CREATE INDEX IF NOT EXISTS idx_agent_readiness_check_results_status
  ON agent_readiness_check_results(status, check_key);
