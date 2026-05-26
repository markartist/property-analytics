-- Migration 0023: Seed Phase 1 platform control-plane rows
-- Source of truth:
--   apps/api/test/helpers/platform-seeds.ts
--   docs/PHASE1_PRODUCTION_ENABLEMENT_CHECKLIST.md
--
-- This migration is intentionally idempotent. It bootstraps the minimum
-- Phase 1 control-plane rows needed for governed mirror intake, execution
-- snapshots, and property advocate runtime flows.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO mirror_domains (domain_key, display_name, owner_team, enabled)
VALUES
  ('ga4', 'GA4', 'marketing_ops', 1),
  ('psi', 'PSI', 'marketing_ops', 1);

INSERT OR IGNORE INTO contract_bundles (
  contract_bundle_id,
  bundle_name,
  bundle_version,
  status,
  schema_bundle_version,
  mirror_contract_version,
  pipeline_health_contract_version,
  execution_snapshot_contract_version,
  agent_contract_set_version,
  lifecycle_contract_version,
  evaluation_contract_version,
  rule_pack_version,
  source_control_ref
) VALUES (
  'cb_phase1_v1',
  'platform_phase1_v1',
  '1.0.0',
  'active',
  'schema_v1',
  'mirror_v1',
  'health_v1',
  'snapshot_v1',
  'agent_v1',
  'lifecycle_v1',
  'evaluation_v1',
  'rules_v1',
  'git:phase1'
);

INSERT OR IGNORE INTO contract_bundle_resolution_policies (
  resolution_policy_id,
  context_type,
  allowed_bundle_statuses_json,
  require_exact_match,
  allow_forward_compatible_components,
  allow_backward_compatible_components,
  block_on_unknown_component
) VALUES
  ('policy_mirror_intake', 'mirror_intake', '["active"]', 1, 0, 0, 1),
  ('policy_snapshot_creation', 'snapshot_creation', '["active"]', 1, 0, 0, 1),
  ('policy_agent_runtime', 'agent_runtime', '["active"]', 1, 0, 0, 1),
  ('policy_lifecycle_promotion', 'lifecycle_promotion', '["active"]', 1, 0, 0, 1),
  ('policy_artifact_generation', 'artifact_generation', '["active"]', 1, 0, 0, 1);

INSERT OR IGNORE INTO pipeline_health_policies (
  domain_key,
  fresh_after_minutes,
  aging_after_minutes,
  stale_after_minutes,
  expire_after_minutes,
  mirror_lag_tolerance_minutes,
  validation_required,
  mirror_required,
  contract_match_required
) VALUES
  ('ga4', 30, 90, 180, 360, 120, 1, 1, 1),
  ('psi', 30, 90, 180, 360, 120, 1, 1, 1);

INSERT OR IGNORE INTO execution_snapshot_policies (
  execution_snapshot_policy_id,
  execution_intent,
  required_domains_json,
  optional_domains_json,
  allow_stale_domains,
  allow_degraded_domains,
  allow_unavailable_domains,
  fail_on_contract_mismatch
) VALUES (
  'exec_policy_property_advocate',
  'property_monitoring',
  '["ga4","psi"]',
  '[]',
  0,
  0,
  0,
  1
);

INSERT OR IGNORE INTO agent_noise_budget_policies (
  noise_budget_policy_id,
  policy_name,
  max_watch_states_per_day,
  max_escalation_candidates_per_day,
  max_escalation_candidates_per_issue_family_per_day,
  cooldown_minutes_per_issue_family,
  suppression_behavior
) VALUES (
  'nb_property_advocate_default',
  'property_advocate_default',
  25,
  10,
  3,
  60,
  'suppress_and_log'
);

INSERT OR IGNORE INTO agent_evaluation_profiles (
  evaluation_profile_id,
  profile_name,
  measure_false_positive_rate,
  measure_missed_issue_rate,
  measure_timeliness,
  measure_acceptance_rate,
  measure_noise_suppression_rate
) VALUES (
  'eval_property_advocate_default',
  'property_advocate_default',
  1,
  1,
  1,
  1,
  1
);

INSERT OR IGNORE INTO agent_contracts (
  agent_contract_id,
  agent_type,
  contract_name,
  contract_version,
  status,
  mission_statement,
  success_criteria,
  allowed_scope_shapes_json,
  required_domains_json,
  optional_domains_json,
  minimum_trust_policy_json,
  allowed_reads_json,
  allowed_writes_json,
  prohibited_actions_json,
  escalation_permissions_json,
  noise_budget_policy_id,
  evaluation_profile_id,
  contract_bundle_id,
  effective_from,
  owner_team
) VALUES (
  'ac_property_advocate_v1',
  'property_advocate',
  'property_advocate_phase1',
  '1.0.0',
  'active',
  'Monitor one property under governed runtime.',
  'Emit bounded watch and escalation signals from validated execution context.',
  '["property"]',
  '["ga4","psi"]',
  '[]',
  '{"domainTrustByDomain":{"ga4":"trusted","psi":"trusted"},"allowedMemoryConsumptionClass":"decision_support"}',
  '["execution_snapshot","pipeline_health_snapshot","watch_state","escalation_candidate"]',
  '["agent_runtime_binding","watch_state","escalation_candidate","issue_lifecycle_event"]',
  '["issue_create","fact_table_write"]',
  '["watch_state","escalation_candidate"]',
  'nb_property_advocate_default',
  'eval_property_advocate_default',
  'cb_phase1_v1',
  datetime('now', '-1 day'),
  'marketing_ops'
);

INSERT OR IGNORE INTO agent_identities (
  agent_id,
  agent_type,
  agent_name,
  agent_contract_id,
  status,
  default_scope_type,
  default_property_id
) VALUES (
  'agent_prop_1',
  'property_advocate',
  'property_advocate_prop_1',
  'ac_property_advocate_v1',
  'active',
  'property',
  'prop_1'
);

INSERT OR IGNORE INTO issue_family_registry (
  issue_family_key,
  allowed_scope_types_json,
  default_promotion_mode,
  default_dedupe_window_minutes,
  default_cooldown_window_minutes,
  active
) VALUES
  ('performance_regression', '["property"]', 'review_required', 120, 60, 1),
  ('data_freshness_risk', '["property"]', 'hold', 120, 60, 1);

INSERT OR IGNORE INTO issue_lifecycle_policies (
  issue_lifecycle_policy_id,
  issue_family_key,
  default_promotion_mode,
  auto_promote_allowed,
  review_required_allowed,
  hold_allowed,
  dedupe_window_minutes,
  cooldown_minutes,
  monitor_tail_minutes
) VALUES
  ('ilp_performance_regression', 'performance_regression', 'review_required', 0, 1, 1, 120, 60, 1440),
  ('ilp_data_freshness_risk', 'data_freshness_risk', 'hold', 0, 1, 1, 120, 60, 1440);
