-- Migration 0021: Phase 1 Property Operations Platform tables
-- Source of truth:
--   Specs 01-07
--   Appendices 08-10
--   Implementation Decisions Batch 01
--   Phase 1 Implementation Plan
--
-- This migration covers the Phase 1 runtime spine:
--   mirror / activation
--   pipeline health / system state
--   execution snapshot
--   contract bundle / provenance
--   agent governance
--   lifecycle MVP

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mirror_domains (
  domain_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  owner_team TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_bundles (
  contract_bundle_id TEXT PRIMARY KEY,
  bundle_name TEXT NOT NULL,
  bundle_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated', 'retired', 'blocked')),
  schema_bundle_version TEXT NOT NULL,
  mirror_contract_version TEXT NOT NULL,
  pipeline_health_contract_version TEXT NOT NULL,
  execution_snapshot_contract_version TEXT NOT NULL,
  agent_contract_set_version TEXT NOT NULL,
  lifecycle_contract_version TEXT NOT NULL,
  evaluation_contract_version TEXT NOT NULL,
  rule_pack_version TEXT NOT NULL,
  source_control_ref TEXT NOT NULL,
  notes TEXT,
  effective_from TEXT,
  effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bundle_name, bundle_version)
);

CREATE TABLE IF NOT EXISTS contract_bundle_components (
  contract_bundle_component_id TEXT PRIMARY KEY,
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  component_name TEXT NOT NULL,
  component_version TEXT NOT NULL,
  source_control_ref TEXT NOT NULL,
  component_hash TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_bundle_id, component_type, component_name)
);

CREATE TABLE IF NOT EXISTS contract_bundle_resolution_policies (
  resolution_policy_id TEXT PRIMARY KEY,
  context_type TEXT NOT NULL CHECK (context_type IN ('mirror_intake', 'snapshot_creation', 'agent_runtime', 'lifecycle_promotion', 'artifact_generation')),
  allowed_bundle_statuses_json TEXT NOT NULL,
  require_exact_match INTEGER NOT NULL CHECK (require_exact_match IN (0, 1)),
  allow_forward_compatible_components INTEGER NOT NULL CHECK (allow_forward_compatible_components IN (0, 1)),
  allow_backward_compatible_components INTEGER NOT NULL CHECK (allow_backward_compatible_components IN (0, 1)),
  block_on_unknown_component INTEGER NOT NULL CHECK (block_on_unknown_component IN (0, 1)),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contract_compatibility_events (
  contract_compatibility_event_id TEXT PRIMARY KEY,
  context_type TEXT NOT NULL CHECK (context_type IN ('mirror_intake', 'snapshot_creation', 'agent_runtime', 'lifecycle_promotion', 'artifact_generation')),
  context_object_type TEXT NOT NULL,
  context_object_id TEXT NOT NULL,
  requested_contract_bundle_id TEXT REFERENCES contract_bundles(contract_bundle_id),
  resolved_contract_bundle_id TEXT REFERENCES contract_bundles(contract_bundle_id),
  compatibility_posture TEXT NOT NULL CHECK (compatibility_posture IN ('compatible', 'mismatch', 'unsupported', 'blocked')),
  event_time TEXT NOT NULL,
  message TEXT NOT NULL,
  failure_code TEXT,
  failure_message TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_contract_compatibility_context
  ON contract_compatibility_events(context_type, event_time DESC);

CREATE TABLE IF NOT EXISTS mirror_batches (
  mirror_batch_id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  source_validation_batch_id TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  schema_bundle_version TEXT NOT NULL,
  validator_bundle_version TEXT NOT NULL,
  mirror_bundle_version TEXT NOT NULL,
  payload_contract_version TEXT NOT NULL,
  contract_bundle_id TEXT REFERENCES contract_bundles(contract_bundle_id),
  batch_date_start TEXT NOT NULL,
  batch_date_end TEXT NOT NULL,
  row_count_total_expected INTEGER NOT NULL,
  row_count_total_received INTEGER NOT NULL DEFAULT 0,
  checksum_manifest TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared', 'mirroring', 'mirrored', 'reconciling', 'reconciled', 'active', 'superseded', 'failed', 'quarantined')),
  notes TEXT,
  source_host TEXT,
  operator_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  mirroring_started_at TEXT,
  mirroring_completed_at TEXT,
  reconciled_at TEXT,
  activated_at TEXT,
  failed_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  UNIQUE (domain_key, source_validation_batch_id)
);

CREATE INDEX IF NOT EXISTS idx_mirror_batches_domain_status_created
  ON mirror_batches(domain_key, status, created_at DESC);

CREATE TABLE IF NOT EXISTS mirror_batch_slices (
  mirror_batch_slice_id TEXT PRIMARY KEY,
  mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  target_table TEXT NOT NULL,
  slice_key TEXT NOT NULL,
  row_count_expected INTEGER NOT NULL,
  row_count_received INTEGER NOT NULL DEFAULT 0,
  slice_checksum_expected TEXT NOT NULL,
  slice_checksum_received TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'writing', 'written', 'reconciled', 'failed', 'quarantined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  failed_at TEXT,
  failure_code TEXT,
  failure_message TEXT,
  UNIQUE (mirror_batch_id, target_table, slice_key)
);

CREATE INDEX IF NOT EXISTS idx_mirror_batch_slices_batch_status
  ON mirror_batch_slices(mirror_batch_id, status);

CREATE TABLE IF NOT EXISTS platform_ga4_daily_metrics (
  id TEXT PRIMARY KEY,
  mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  source_validation_batch_id TEXT NOT NULL,
  schema_bundle_version TEXT NOT NULL,
  payload_contract_version TEXT NOT NULL,
  property_id TEXT NOT NULL,
  ga4_property_id TEXT,
  metric_date TEXT NOT NULL,
  total_users INTEGER,
  new_users INTEGER,
  sessions INTEGER,
  pageviews INTEGER,
  avg_session_duration_seconds REAL,
  bounce_rate REAL,
  source_row_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mirror_batch_id, property_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_platform_ga4_batch_date
  ON platform_ga4_daily_metrics(mirror_batch_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS platform_psi_daily_metrics (
  id TEXT PRIMARY KEY,
  mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  source_validation_batch_id TEXT NOT NULL,
  schema_bundle_version TEXT NOT NULL,
  payload_contract_version TEXT NOT NULL,
  property_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
  performance_score REAL,
  accessibility_score REAL,
  best_practices_score REAL,
  seo_score REAL,
  lcp_seconds REAL,
  cls_value REAL,
  fcp_seconds REAL,
  tbt_ms REAL,
  inp_ms REAL,
  ttfb_ms REAL,
  source_row_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (mirror_batch_id, property_id, metric_date, strategy)
);

CREATE INDEX IF NOT EXISTS idx_platform_psi_batch_date
  ON platform_psi_daily_metrics(mirror_batch_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS active_batch_pointers (
  domain_key TEXT PRIMARY KEY REFERENCES mirror_domains(domain_key),
  active_mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id),
  activated_at TEXT NOT NULL,
  previous_mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mirror_activation_events (
  activation_event_id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id),
  previous_mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  activation_reason TEXT NOT NULL,
  activated_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mirror_activation_domain_created
  ON mirror_activation_events(domain_key, created_at DESC);

CREATE TABLE IF NOT EXISTS system_state_events (
  system_state_event_id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  event_type TEXT NOT NULL,
  event_status TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  event_time TEXT NOT NULL,
  source_component TEXT NOT NULL,
  source_host TEXT NOT NULL,
  source_validation_batch_id TEXT,
  mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  active_mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  schema_bundle_version TEXT,
  validator_bundle_version TEXT,
  mirror_bundle_version TEXT,
  contract_bundle_id TEXT REFERENCES contract_bundles(contract_bundle_id),
  message TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  property_scope TEXT,
  cohort_scope TEXT,
  failure_code TEXT,
  failure_message TEXT,
  related_event_id TEXT REFERENCES system_state_events(system_state_event_id)
);

CREATE INDEX IF NOT EXISTS idx_system_state_domain_time
  ON system_state_events(domain_key, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_system_state_type_status
  ON system_state_events(event_type, event_status, event_time DESC);

CREATE TABLE IF NOT EXISTS pipeline_health_policies (
  domain_key TEXT PRIMARY KEY REFERENCES mirror_domains(domain_key),
  fresh_after_minutes INTEGER NOT NULL CHECK (fresh_after_minutes > 0),
  aging_after_minutes INTEGER NOT NULL CHECK (aging_after_minutes > 0),
  stale_after_minutes INTEGER NOT NULL CHECK (stale_after_minutes > 0),
  expire_after_minutes INTEGER NOT NULL CHECK (expire_after_minutes > 0),
  mirror_lag_tolerance_minutes INTEGER NOT NULL CHECK (mirror_lag_tolerance_minutes >= 0),
  validation_required INTEGER NOT NULL CHECK (validation_required IN (0, 1)),
  mirror_required INTEGER NOT NULL CHECK (mirror_required IN (0, 1)),
  contract_match_required INTEGER NOT NULL CHECK (contract_match_required IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (fresh_after_minutes < aging_after_minutes),
  CHECK (aging_after_minutes < stale_after_minutes),
  CHECK (stale_after_minutes < expire_after_minutes)
);

CREATE TABLE IF NOT EXISTS pipeline_health_snapshots (
  pipeline_health_snapshot_id TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  snapshot_time TEXT NOT NULL,
  latest_collection_event_id TEXT REFERENCES system_state_events(system_state_event_id),
  latest_validation_event_id TEXT REFERENCES system_state_events(system_state_event_id),
  latest_mirror_event_id TEXT REFERENCES system_state_events(system_state_event_id),
  latest_activation_event_id TEXT REFERENCES system_state_events(system_state_event_id),
  latest_contract_event_id TEXT REFERENCES system_state_events(system_state_event_id),
  latest_local_run_at TEXT,
  latest_successful_local_run_at TEXT,
  latest_validated_batch_id TEXT,
  latest_validated_data_through TEXT,
  latest_mirror_attempt_at TEXT,
  latest_mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  active_mirror_batch_id TEXT REFERENCES mirror_batches(mirror_batch_id),
  latest_active_batch_activated_at TEXT,
  active_data_through TEXT,
  freshness_posture TEXT NOT NULL CHECK (freshness_posture IN ('fresh', 'aging', 'stale', 'expired', 'unknown')),
  validation_posture TEXT NOT NULL CHECK (validation_posture IN ('validated', 'validation_pending', 'validation_failed', 'validation_blocked', 'unknown')),
  mirror_posture TEXT NOT NULL CHECK (mirror_posture IN ('active', 'lagging', 'mirroring', 'mirror_failed', 'reconciliation_failed', 'activation_blocked', 'unknown')),
  active_batch_posture TEXT NOT NULL CHECK (active_batch_posture IN ('current', 'lagging', 'missing', 'blocked', 'unknown')),
  contract_posture TEXT NOT NULL CHECK (contract_posture IN ('matched', 'mismatch', 'unsupported', 'unknown')),
  domain_trust_posture TEXT NOT NULL CHECK (domain_trust_posture IN ('trusted', 'stale', 'degraded', 'unavailable')),
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  blocking_count INTEGER NOT NULL DEFAULT 0,
  status_summary TEXT NOT NULL,
  effective_state_reason_codes TEXT NOT NULL,
  latest_failure_code TEXT,
  latest_failure_message TEXT,
  notes TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  contract_bundle_id TEXT REFERENCES contract_bundles(contract_bundle_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_health_domain_time
  ON pipeline_health_snapshots(domain_key, snapshot_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_health_current_domain
  ON pipeline_health_snapshots(domain_key)
  WHERE is_current = 1;

CREATE TABLE IF NOT EXISTS execution_snapshot_policies (
  execution_snapshot_policy_id TEXT PRIMARY KEY,
  execution_intent TEXT NOT NULL,
  required_domains_json TEXT NOT NULL,
  optional_domains_json TEXT NOT NULL,
  allow_stale_domains INTEGER NOT NULL CHECK (allow_stale_domains IN (0, 1)),
  allow_degraded_domains INTEGER NOT NULL CHECK (allow_degraded_domains IN (0, 1)),
  allow_unavailable_domains INTEGER NOT NULL CHECK (allow_unavailable_domains IN (0, 1)),
  fail_on_contract_mismatch INTEGER NOT NULL CHECK (fail_on_contract_mismatch IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS execution_snapshots (
  execution_snapshot_id TEXT PRIMARY KEY,
  snapshot_time TEXT NOT NULL,
  execution_intent TEXT NOT NULL,
  execution_consumer_type TEXT NOT NULL,
  execution_consumer_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  trigger_reference_id TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('property', 'cohort', 'portfolio', 'global', 'system')),
  property_id TEXT,
  cohort_key TEXT,
  portfolio_scope_key TEXT,
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  pipeline_health_snapshot_set_hash TEXT NOT NULL,
  binding_input_hash TEXT NOT NULL,
  domain_binding_count INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  notes TEXT,
  operator_id TEXT,
  requested_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (scope_type = 'property' AND property_id IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'cohort' AND property_id IS NULL AND cohort_key IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'portfolio' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NOT NULL) OR
    (scope_type IN ('global', 'system') AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_execution_snapshots_scope_created
  ON execution_snapshots(scope_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_snapshots_bundle_created
  ON execution_snapshots(contract_bundle_id, created_at DESC);

CREATE TABLE IF NOT EXISTS execution_snapshot_domain_bindings (
  execution_snapshot_domain_binding_id TEXT PRIMARY KEY,
  execution_snapshot_id TEXT NOT NULL REFERENCES execution_snapshots(execution_snapshot_id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL REFERENCES mirror_domains(domain_key),
  active_mirror_batch_id TEXT NOT NULL REFERENCES mirror_batches(mirror_batch_id),
  pipeline_health_snapshot_id TEXT NOT NULL REFERENCES pipeline_health_snapshots(pipeline_health_snapshot_id),
  domain_trust_posture TEXT NOT NULL CHECK (domain_trust_posture IN ('trusted', 'stale', 'degraded', 'unavailable')),
  freshness_posture TEXT NOT NULL CHECK (freshness_posture IN ('fresh', 'aging', 'stale', 'expired', 'unknown')),
  validation_posture TEXT NOT NULL CHECK (validation_posture IN ('validated', 'validation_pending', 'validation_failed', 'validation_blocked', 'unknown')),
  mirror_posture TEXT NOT NULL CHECK (mirror_posture IN ('active', 'lagging', 'mirroring', 'mirror_failed', 'reconciliation_failed', 'activation_blocked', 'unknown')),
  active_batch_posture TEXT NOT NULL CHECK (active_batch_posture IN ('current', 'lagging', 'missing', 'blocked', 'unknown')),
  contract_posture TEXT NOT NULL CHECK (contract_posture IN ('matched', 'mismatch', 'unsupported', 'unknown')),
  active_data_through TEXT,
  binding_status TEXT NOT NULL CHECK (binding_status IN ('usable', 'degraded', 'stale', 'excluded', 'unavailable')),
  notes TEXT,
  latest_validated_batch_id TEXT,
  effective_state_reason_codes TEXT,
  bound_at TEXT NOT NULL,
  UNIQUE (execution_snapshot_id, domain_key)
);

CREATE INDEX IF NOT EXISTS idx_execution_binding_snapshot
  ON execution_snapshot_domain_bindings(execution_snapshot_id);

CREATE TABLE IF NOT EXISTS agent_noise_budget_policies (
  noise_budget_policy_id TEXT PRIMARY KEY,
  policy_name TEXT NOT NULL,
  max_watch_states_per_day INTEGER NOT NULL CHECK (max_watch_states_per_day >= 0),
  max_escalation_candidates_per_day INTEGER NOT NULL CHECK (max_escalation_candidates_per_day >= 0),
  max_escalation_candidates_per_issue_family_per_day INTEGER NOT NULL CHECK (max_escalation_candidates_per_issue_family_per_day >= 0),
  cooldown_minutes_per_issue_family INTEGER NOT NULL CHECK (cooldown_minutes_per_issue_family >= 0),
  suppression_behavior TEXT NOT NULL CHECK (suppression_behavior IN ('suppress_and_log', 'suppress_and_review', 'block_and_escalate')),
  max_recommendations_per_day INTEGER,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_evaluation_profiles (
  evaluation_profile_id TEXT PRIMARY KEY,
  profile_name TEXT NOT NULL,
  measure_false_positive_rate INTEGER NOT NULL CHECK (measure_false_positive_rate IN (0, 1)),
  measure_missed_issue_rate INTEGER NOT NULL CHECK (measure_missed_issue_rate IN (0, 1)),
  measure_timeliness INTEGER NOT NULL CHECK (measure_timeliness IN (0, 1)),
  measure_acceptance_rate INTEGER NOT NULL CHECK (measure_acceptance_rate IN (0, 1)),
  measure_noise_suppression_rate INTEGER NOT NULL CHECK (measure_noise_suppression_rate IN (0, 1)),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_contracts (
  agent_contract_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'suspended', 'retired')),
  mission_statement TEXT NOT NULL,
  success_criteria TEXT NOT NULL,
  allowed_scope_shapes_json TEXT NOT NULL,
  required_domains_json TEXT NOT NULL,
  optional_domains_json TEXT NOT NULL,
  minimum_trust_policy_json TEXT NOT NULL,
  allowed_reads_json TEXT NOT NULL,
  allowed_writes_json TEXT NOT NULL,
  prohibited_actions_json TEXT NOT NULL,
  escalation_permissions_json TEXT NOT NULL,
  noise_budget_policy_id TEXT NOT NULL REFERENCES agent_noise_budget_policies(noise_budget_policy_id),
  evaluation_profile_id TEXT NOT NULL REFERENCES agent_evaluation_profiles(evaluation_profile_id),
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  notes TEXT,
  owner_team TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (agent_type, contract_name, contract_version)
);

CREATE INDEX IF NOT EXISTS idx_agent_contract_type_status
  ON agent_contracts(agent_type, status, effective_from DESC);

CREATE TABLE IF NOT EXISTS agent_identities (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_contract_id TEXT NOT NULL REFERENCES agent_contracts(agent_contract_id),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'degraded', 'suspended', 'retired')),
  default_scope_type TEXT NOT NULL CHECK (default_scope_type IN ('property', 'cohort', 'portfolio', 'global', 'system')),
  default_property_id TEXT,
  default_cohort_key TEXT,
  default_portfolio_scope_key TEXT,
  supervisor_agent_id TEXT REFERENCES agent_identities(agent_id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (agent_name)
);

CREATE TABLE IF NOT EXISTS agent_runtime_bindings (
  agent_runtime_binding_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_identities(agent_id),
  agent_contract_id TEXT NOT NULL REFERENCES agent_contracts(agent_contract_id),
  execution_snapshot_id TEXT NOT NULL REFERENCES execution_snapshots(execution_snapshot_id),
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  trigger_type TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('property', 'cohort', 'portfolio', 'global', 'system')),
  property_id TEXT,
  cohort_key TEXT,
  portfolio_scope_key TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (scope_type = 'property' AND property_id IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'cohort' AND property_id IS NULL AND cohort_key IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'portfolio' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NOT NULL) OR
    (scope_type IN ('global', 'system') AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NULL)
  ),
  UNIQUE (agent_id, execution_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_runtime_agent_created
  ON agent_runtime_bindings(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runtime_snapshot
  ON agent_runtime_bindings(execution_snapshot_id);

CREATE TABLE IF NOT EXISTS issue_family_registry (
  issue_family_key TEXT PRIMARY KEY,
  allowed_scope_types_json TEXT NOT NULL,
  default_promotion_mode TEXT NOT NULL CHECK (default_promotion_mode IN ('auto', 'review_required', 'hold')),
  default_dedupe_window_minutes INTEGER NOT NULL CHECK (default_dedupe_window_minutes >= 0),
  default_cooldown_window_minutes INTEGER NOT NULL CHECK (default_cooldown_window_minutes >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issue_lifecycle_policies (
  issue_lifecycle_policy_id TEXT PRIMARY KEY,
  issue_family_key TEXT NOT NULL REFERENCES issue_family_registry(issue_family_key),
  default_promotion_mode TEXT NOT NULL CHECK (default_promotion_mode IN ('auto', 'review_required', 'hold')),
  auto_promote_allowed INTEGER NOT NULL CHECK (auto_promote_allowed IN (0, 1)),
  review_required_allowed INTEGER NOT NULL CHECK (review_required_allowed IN (0, 1)),
  hold_allowed INTEGER NOT NULL CHECK (hold_allowed IN (0, 1)),
  dedupe_window_minutes INTEGER NOT NULL CHECK (dedupe_window_minutes >= 0),
  cooldown_minutes INTEGER NOT NULL CHECK (cooldown_minutes >= 0),
  monitor_tail_minutes INTEGER NOT NULL CHECK (monitor_tail_minutes >= 0),
  severity_override_rules_json TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provenance_envelopes (
  provenance_envelope_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  source_batch_ids_json TEXT NOT NULL,
  execution_snapshot_id TEXT REFERENCES execution_snapshots(execution_snapshot_id),
  agent_contract_id TEXT REFERENCES agent_contracts(agent_contract_id),
  agent_id TEXT REFERENCES agent_identities(agent_id),
  pipeline_health_snapshot_ids_json TEXT NOT NULL,
  upstream_object_refs_json TEXT NOT NULL,
  created_by_type TEXT NOT NULL,
  created_by_id TEXT NOT NULL,
  metadata_json TEXT,
  artifact_uri TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_object
  ON provenance_envelopes(object_type, object_id);

CREATE TABLE IF NOT EXISTS watch_states (
  watch_state_id TEXT PRIMARY KEY,
  issue_family_key TEXT NOT NULL REFERENCES issue_family_registry(issue_family_key),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('property', 'cohort', 'portfolio', 'global')),
  property_id TEXT,
  cohort_key TEXT,
  portfolio_scope_key TEXT,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  watch_reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'suppressed', 'expired', 'promoted', 'closed')),
  source_type TEXT NOT NULL,
  source_actor_id TEXT NOT NULL,
  execution_snapshot_id TEXT NOT NULL REFERENCES execution_snapshots(execution_snapshot_id),
  agent_contract_id TEXT REFERENCES agent_contracts(agent_contract_id),
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  expires_at TEXT,
  cooldown_until TEXT,
  dedupe_key TEXT NOT NULL,
  CHECK (
    (scope_type = 'property' AND property_id IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'cohort' AND property_id IS NULL AND cohort_key IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'portfolio' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NOT NULL) OR
    (scope_type = 'global' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_watch_states_scope_status
  ON watch_states(scope_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_states_issue_dedupe
  ON watch_states(issue_family_key, dedupe_key, status);

CREATE TABLE IF NOT EXISTS escalation_candidates (
  escalation_candidate_id TEXT PRIMARY KEY,
  issue_family_key TEXT NOT NULL REFERENCES issue_family_registry(issue_family_key),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('property', 'cohort', 'portfolio', 'global')),
  property_id TEXT,
  cohort_key TEXT,
  portfolio_scope_key TEXT,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  promotion_mode TEXT NOT NULL CHECK (promotion_mode IN ('auto', 'review_required', 'hold')),
  candidate_reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'under_review', 'held', 'promoted', 'rejected', 'suppressed', 'closed')),
  source_type TEXT NOT NULL,
  source_actor_id TEXT NOT NULL,
  execution_snapshot_id TEXT NOT NULL REFERENCES execution_snapshots(execution_snapshot_id),
  agent_contract_id TEXT REFERENCES agent_contracts(agent_contract_id),
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  first_observed_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  review_required_by TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  hold_until TEXT,
  cooldown_until TEXT,
  related_watch_state_id TEXT REFERENCES watch_states(watch_state_id),
  dedupe_key TEXT NOT NULL,
  CHECK (
    (scope_type = 'property' AND property_id IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'cohort' AND property_id IS NULL AND cohort_key IS NOT NULL AND portfolio_scope_key IS NULL) OR
    (scope_type = 'portfolio' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NOT NULL) OR
    (scope_type = 'global' AND property_id IS NULL AND cohort_key IS NULL AND portfolio_scope_key IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_escalation_candidates_scope_status
  ON escalation_candidates(scope_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escalation_candidates_issue_dedupe
  ON escalation_candidates(issue_family_key, dedupe_key, status);

CREATE TABLE IF NOT EXISTS issue_lifecycle_events (
  issue_lifecycle_event_id TEXT PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('watch_state', 'escalation_candidate', 'issue')),
  object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_actor_type TEXT NOT NULL,
  event_actor_id TEXT NOT NULL,
  event_time TEXT NOT NULL,
  execution_snapshot_id TEXT REFERENCES execution_snapshots(execution_snapshot_id),
  agent_contract_id TEXT REFERENCES agent_contracts(agent_contract_id),
  contract_bundle_id TEXT NOT NULL REFERENCES contract_bundles(contract_bundle_id),
  message TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_issue_lifecycle_object_time
  ON issue_lifecycle_events(object_type, object_id, event_time DESC);
