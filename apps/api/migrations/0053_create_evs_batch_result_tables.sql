-- Migration 0053: EVS evaluation sets, batch execution, and queryable finding persistence
-- Adds durable evaluation-set/batch/target/run/finding tables beside the existing
-- EVS request/result blob tables so launch batches can be compared and filtered
-- without parsing JSON.

CREATE TABLE IF NOT EXISTS evs_evaluation_sets (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  source_contract_path TEXT,
  source_contract_hash TEXT,
  default_profiles_json TEXT NOT NULL,
  default_device_profiles_json TEXT NOT NULL,
  owner_lane TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_evaluation_sets_status
  ON evs_evaluation_sets(status, key);

INSERT OR IGNORE INTO evs_evaluation_sets (
  id, key, name, description, source_contract_path, source_contract_hash,
  default_profiles_json, default_device_profiles_json, owner_lane, status,
  metadata_json, created_at, updated_at
) VALUES (
  'evs_eval_portfolio_functionality_v1',
  'portfolio_functionality_qa_v1',
  'Portfolio Functionality QA v1',
  'Workbook-backed EVS evaluation set for reusable property-site functionality audits.',
  'evs/config/portfolio-functionality-qa-contract.json',
  '91468d634b87bfcc81f9db5770295b2d584fab67a74e5e654bd425534ea41ee8',
  '["header_navigation_integrity","portfolio_functionality_regression","apartments_pricing_deep_journey","apartments_pricing_mobile_journey"]',
  '["desktop_chrome","iphone_safari"]',
  'evs',
  'active',
  '{"source":"_QA_Round 1_Property_Websites.xlsx","scope":"Functionality and Data Integrity rows owned or observed by EVS"}',
  '2026-05-12T00:00:00.000Z',
  '2026-05-12T00:00:00.000Z'
);

INSERT OR IGNORE INTO evs_evaluation_sets (
  id, key, name, description, source_contract_path, source_contract_hash,
  default_profiles_json, default_device_profiles_json, owner_lane, status,
  metadata_json, created_at, updated_at
) VALUES (
  'evs_eval_contact_form_checks_v1',
  'contact_form_checks_v1',
  'Contact Form Checks v1',
  'Separate guarded EVS evaluation set for contact-form required-field validation and explicitly approved synthetic submissions.',
  'evs/config/portfolio-functionality-qa-contract.json',
  '91468d634b87bfcc81f9db5770295b2d584fab67a74e5e654bd425534ea41ee8',
  '["contact_form_checks"]',
  '["desktop_chrome","iphone_safari"]',
  'forms_qa',
  'draft',
  '{"source":"_QA_Round 1_Property_Websites.xlsx","scope":"Rows 164-165; submission remains disabled unless synthetic-form governance toggles are set"}',
  '2026-05-13T00:00:00.000Z',
  '2026-05-13T00:00:00.000Z'
);

INSERT OR IGNORE INTO evs_evaluation_sets (
  id, key, name, description, source_contract_path, source_contract_hash,
  default_profiles_json, default_device_profiles_json, owner_lane, status,
  metadata_json, created_at, updated_at
) VALUES (
  'evs_eval_lead_attribution_e2e_v1',
  'lead_attribution_e2e_v1',
  'Lead Attribution E2E v1',
  'Separate EVS evaluation set for feed-backed advertiser URL, phone-swap, recipient-email, and governed synthetic-form attribution checks.',
  'evs/config/lead-attribution-e2e.json',
  '3da8937e7d0169aed228ba06d8726cc32638996663af939eb478f4c58e78e5c7',
  '["lead_attribution_e2e"]',
  '["desktop_chrome","iphone_safari"]',
  'lead_attribution_qa',
  'draft',
  '{"source":"thirtylines_feed_snapshots.trackingCodes","scope":"Dormant until synthetic-lead submission policy is approved"}',
  '2026-05-12T00:00:00.000Z',
  '2026-05-12T00:00:00.000Z'
);

CREATE TABLE IF NOT EXISTS evs_batches (
  id TEXT PRIMARY KEY,
  evaluation_set_id TEXT REFERENCES evs_evaluation_sets(id),
  name TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('staging', 'prod')),
  source_label TEXT,
  input_urls_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
  requested_by TEXT,
  metadata_json TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_batches_evaluation_set
  ON evs_batches(evaluation_set_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evs_batches_status_created
  ON evs_batches(status, created_at DESC);

CREATE TABLE IF NOT EXISTS evs_batch_targets (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES evs_batches(id) ON DELETE CASCADE,
  property_id TEXT,
  property_name TEXT,
  property_code TEXT,
  target_url TEXT NOT NULL,
  identity_status TEXT NOT NULL CHECK (identity_status IN ('resolved', 'unresolved', 'ambiguous', 'manual')),
  site_os_version TEXT,
  template_family TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_batch_targets_batch_status
  ON evs_batch_targets(batch_id, status);

CREATE INDEX IF NOT EXISTS idx_evs_batch_targets_property
  ON evs_batch_targets(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evs_batch_targets_url
  ON evs_batch_targets(target_url);

CREATE TABLE IF NOT EXISTS evs_batch_runs (
  id TEXT PRIMARY KEY,
  batch_target_id TEXT NOT NULL REFERENCES evs_batch_targets(id) ON DELETE CASCADE,
  request_id TEXT REFERENCES evs_requests(id),
  profile TEXT NOT NULL CHECK (profile IN ('broad_experiential_homepage', 'critical_cta_smoke', 'header_navigation_integrity', 'portfolio_functionality_regression', 'apartments_pricing_deep_journey', 'apartments_pricing_mobile_journey', 'contact_form_checks', 'lead_attribution_e2e')),
  device_profile TEXT NOT NULL CHECK (device_profile IN ('iphone_safari', 'desktop_chrome')),
  provider TEXT NOT NULL CHECK (provider IN ('browserstack')),
  provider_build_name TEXT,
  raw_artifact_path TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  classification TEXT,
  duration_ms INTEGER,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_batch_runs_target_profile_device
  ON evs_batch_runs(batch_target_id, profile, device_profile);

CREATE INDEX IF NOT EXISTS idx_evs_batch_runs_request
  ON evs_batch_runs(request_id);

CREATE INDEX IF NOT EXISTS idx_evs_batch_runs_status
  ON evs_batch_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS evs_findings (
  id TEXT PRIMARY KEY,
  batch_run_id TEXT REFERENCES evs_batch_runs(id) ON DELETE CASCADE,
  request_id TEXT REFERENCES evs_requests(id),
  property_id TEXT,
  profile TEXT NOT NULL CHECK (profile IN ('broad_experiential_homepage', 'critical_cta_smoke', 'header_navigation_integrity', 'portfolio_functionality_regression', 'apartments_pricing_deep_journey', 'apartments_pricing_mobile_journey', 'contact_form_checks', 'lead_attribution_e2e')),
  device_profile TEXT NOT NULL CHECK (device_profile IN ('iphone_safari', 'desktop_chrome')),
  check_id TEXT NOT NULL,
  category TEXT NOT NULL,
  owner_lane TEXT,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warn', 'skipped')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  label TEXT NOT NULL,
  message TEXT NOT NULL,
  source_workbook TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  assertion_type TEXT,
  side_effect_policy TEXT,
  classification TEXT,
  metadata_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_findings_batch_run_status
  ON evs_findings(batch_run_id, status);

CREATE INDEX IF NOT EXISTS idx_evs_findings_property_check
  ON evs_findings(property_id, check_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evs_findings_profile_device_status
  ON evs_findings(profile, device_profile, status);

CREATE INDEX IF NOT EXISTS idx_evs_findings_source_row
  ON evs_findings(source_workbook, source_sheet, source_row);

CREATE TABLE IF NOT EXISTS evs_source_truth_snapshots (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES evs_batches(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_system TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  generated_at TEXT,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evs_source_truth_snapshots_batch_kind
  ON evs_source_truth_snapshots(batch_id, kind);
