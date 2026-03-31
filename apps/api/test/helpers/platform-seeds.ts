import { run } from "../../src/lib/db";

export async function seedPhase1PlatformBasics(db: D1Database): Promise<void> {
  await run(
    db,
    `INSERT INTO mirror_domains (domain_key, display_name, owner_team, enabled)
     VALUES
      ('ga4', 'GA4', 'marketing_ops', 1),
      ('psi', 'PSI', 'marketing_ops', 1)`
  );

  await run(
    db,
    `INSERT INTO contract_bundles (
      contract_bundle_id, bundle_name, bundle_version, status, schema_bundle_version, mirror_contract_version,
      pipeline_health_contract_version, execution_snapshot_contract_version, agent_contract_set_version,
      lifecycle_contract_version, evaluation_contract_version, rule_pack_version, source_control_ref
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "cb_phase1_v1",
      "platform_phase1_v1",
      "1.0.0",
      "schema_v1",
      "mirror_v1",
      "health_v1",
      "snapshot_v1",
      "agent_v1",
      "lifecycle_v1",
      "evaluation_v1",
      "rules_v1",
      "git:phase1",
    ]
  );

  for (const contextType of [
    "mirror_intake",
    "snapshot_creation",
    "agent_runtime",
    "lifecycle_promotion",
    "artifact_generation",
  ]) {
    await run(
      db,
      `INSERT INTO contract_bundle_resolution_policies (
        resolution_policy_id, context_type, allowed_bundle_statuses_json,
        require_exact_match, allow_forward_compatible_components,
        allow_backward_compatible_components, block_on_unknown_component
      ) VALUES (?, ?, ?, 1, 0, 0, 1)`,
      [`policy_${contextType}`, contextType, JSON.stringify(["active"])]
    );
  }

  await run(
    db,
    `INSERT INTO pipeline_health_policies (
      domain_key, fresh_after_minutes, aging_after_minutes, stale_after_minutes, expire_after_minutes,
      mirror_lag_tolerance_minutes, validation_required, mirror_required, contract_match_required
    ) VALUES
      ('ga4', 30, 90, 180, 360, 120, 1, 1, 1),
      ('psi', 30, 90, 180, 360, 120, 1, 1, 1)`
  );

  await run(
    db,
    `INSERT INTO execution_snapshot_policies (
      execution_snapshot_policy_id, execution_intent, required_domains_json, optional_domains_json,
      allow_stale_domains, allow_degraded_domains, allow_unavailable_domains, fail_on_contract_mismatch
    ) VALUES
      ('exec_policy_property_advocate', 'property_monitoring', ?, '[]', 0, 0, 0, 1)`,
    [JSON.stringify(["ga4", "psi"])]
  );

  await run(
    db,
    `INSERT INTO agent_noise_budget_policies (
      noise_budget_policy_id, policy_name, max_watch_states_per_day, max_escalation_candidates_per_day,
      max_escalation_candidates_per_issue_family_per_day, cooldown_minutes_per_issue_family, suppression_behavior
    ) VALUES (?, 'property_advocate_default', 25, 10, 3, 60, 'suppress_and_log')`,
    ["nb_property_advocate_default"]
  );

  await run(
    db,
    `INSERT INTO agent_evaluation_profiles (
      evaluation_profile_id, profile_name, measure_false_positive_rate, measure_missed_issue_rate,
      measure_timeliness, measure_acceptance_rate, measure_noise_suppression_rate
    ) VALUES (?, 'property_advocate_default', 1, 1, 1, 1, 1)`,
    ["eval_property_advocate_default"]
  );

  await run(
    db,
    `INSERT INTO agent_contracts (
      agent_contract_id, agent_type, contract_name, contract_version, status, mission_statement,
      success_criteria, allowed_scope_shapes_json, required_domains_json, optional_domains_json,
      minimum_trust_policy_json, allowed_reads_json, allowed_writes_json, prohibited_actions_json,
      escalation_permissions_json, noise_budget_policy_id, evaluation_profile_id, contract_bundle_id,
      effective_from, owner_team
    ) VALUES (
      ?, 'property_advocate', 'property_advocate_phase1', '1.0.0', 'active',
      'Monitor one property under governed runtime.',
      'Emit bounded watch and escalation signals from validated execution context.',
      ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-1 day'), 'marketing_ops'
    )`,
    [
      "ac_property_advocate_v1",
      JSON.stringify(["property"]),
      JSON.stringify(["ga4", "psi"]),
      JSON.stringify({
        domainTrustByDomain: { ga4: "trusted", psi: "trusted" },
        allowedMemoryConsumptionClass: "decision_support",
      }),
      JSON.stringify(["execution_snapshot", "pipeline_health_snapshot", "watch_state", "escalation_candidate"]),
      JSON.stringify(["agent_runtime_binding", "watch_state", "escalation_candidate", "issue_lifecycle_event"]),
      JSON.stringify(["issue_create", "fact_table_write"]),
      JSON.stringify(["watch_state", "escalation_candidate"]),
      "nb_property_advocate_default",
      "eval_property_advocate_default",
      "cb_phase1_v1",
    ]
  );

  await run(
    db,
    `INSERT INTO agent_identities (
      agent_id, agent_type, agent_name, agent_contract_id, status, default_scope_type, default_property_id
    ) VALUES (?, 'property_advocate', 'property_advocate_prop_1', ?, 'active', 'property', 'prop_1')`,
    ["agent_prop_1", "ac_property_advocate_v1"]
  );

  await run(
    db,
    `INSERT INTO issue_family_registry (
      issue_family_key, allowed_scope_types_json, default_promotion_mode,
      default_dedupe_window_minutes, default_cooldown_window_minutes, active
    ) VALUES
      ('performance_regression', ?, 'review_required', 120, 60, 1),
      ('data_freshness_risk', ?, 'hold', 120, 60, 1)`,
    [JSON.stringify(["property"]), JSON.stringify(["property"])]
  );

  await run(
    db,
    `INSERT INTO issue_lifecycle_policies (
      issue_lifecycle_policy_id, issue_family_key, default_promotion_mode,
      auto_promote_allowed, review_required_allowed, hold_allowed,
      dedupe_window_minutes, cooldown_minutes, monitor_tail_minutes
    ) VALUES
      ('ilp_performance_regression', 'performance_regression', 'review_required', 0, 1, 1, 120, 60, 1440),
      ('ilp_data_freshness_risk', 'data_freshness_risk', 'hold', 0, 1, 1, 120, 60, 1440)`
  );
}
