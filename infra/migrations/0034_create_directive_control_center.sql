-- Infra Migration 0034 / App Migration 0047: Directive Control Center
-- Directives are operational policy data for Captain / Commodore / Fleet /
-- Expert Bench / Fleet Scribe behavior. Drafts are versioned, validation is
-- auditable, and only approved/active versions are runtime-eligible.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS directive_profiles (
  profile_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  office_type TEXT NOT NULL,
  plain_role TEXT,
  owner TEXT NOT NULL,
  active_status TEXT NOT NULL CHECK (active_status IN ('active', 'paused', 'retired')),
  current_active_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directive_profiles_office
  ON directive_profiles(office_type, active_status, role_name);

CREATE TABLE IF NOT EXISTS directive_versions (
  version_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES directive_profiles(profile_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  approval_status TEXT NOT NULL CHECK (
    approval_status IN ('draft', 'submitted_for_review', 'approved', 'active', 'rejected', 'retired', 'rolled_back')
  ),
  purpose TEXT NOT NULL,
  decision_questions_json TEXT NOT NULL,
  primary_sources_json TEXT NOT NULL,
  advisory_sources_json TEXT NOT NULL,
  output_contract TEXT NOT NULL,
  current_directive_setting TEXT NOT NULL,
  hard_guardrails_json TEXT NOT NULL,
  do_not_allow_rules_json TEXT NOT NULL,
  required_evidence_json TEXT NOT NULL,
  confidence_thresholds_json TEXT NOT NULL,
  freshness_tolerance_json TEXT NOT NULL,
  escalation_triggers_json TEXT NOT NULL,
  publication_permissions_json TEXT NOT NULL,
  external_communication_permissions_json TEXT NOT NULL,
  report_family_applicability_json TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  retired_date TEXT,
  change_reason TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  directive_hash TEXT,
  UNIQUE(profile_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_active
  ON directive_versions(profile_id)
  WHERE approval_status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_draft
  ON directive_versions(profile_id)
  WHERE approval_status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS idx_directive_versions_one_submitted
  ON directive_versions(profile_id)
  WHERE approval_status = 'submitted_for_review';

CREATE INDEX IF NOT EXISTS idx_directive_versions_role_status
  ON directive_versions(role_id, approval_status, version DESC);

CREATE TABLE IF NOT EXISTS directive_change_requests (
  request_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES directive_profiles(profile_id) ON DELETE CASCADE,
  draft_version_id TEXT NOT NULL REFERENCES directive_versions(version_id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  risk_flags_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted_for_review', 'approved', 'rejected', 'cancelled')),
  submitted_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directive_change_requests_profile
  ON directive_change_requests(profile_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS directive_approval_events (
  approval_event_id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES directive_change_requests(request_id) ON DELETE SET NULL,
  profile_id TEXT NOT NULL REFERENCES directive_profiles(profile_id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES directive_versions(version_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('submitted', 'approved', 'activated', 'rejected', 'retired', 'rolled_back')
  ),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  event_at TEXT NOT NULL,
  before_snapshot_json TEXT,
  after_snapshot_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_directive_approval_events_profile
  ON directive_approval_events(profile_id, event_at DESC);

CREATE TABLE IF NOT EXISTS directive_runtime_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES directive_profiles(profile_id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES directive_versions(version_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  runtime_mode TEXT NOT NULL,
  property_id TEXT,
  report_family TEXT,
  as_of_date TEXT NOT NULL,
  directive_snapshot_json TEXT NOT NULL,
  validation_status_json TEXT NOT NULL,
  snapshot_hash TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directive_runtime_snapshots_role
  ON directive_runtime_snapshots(role_id, created_at DESC);

CREATE TABLE IF NOT EXISTS directive_validation_results (
  validation_result_id TEXT PRIMARY KEY,
  profile_id TEXT,
  version_id TEXT,
  role_id TEXT,
  validation_status TEXT NOT NULL CHECK (validation_status IN ('pass', 'fail')),
  warnings_json TEXT NOT NULL,
  blocking_errors_json TEXT NOT NULL,
  recommended_fixes_json TEXT NOT NULL,
  validated_by TEXT NOT NULL,
  validated_at TEXT NOT NULL,
  runtime_context_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_directive_validation_results_version
  ON directive_validation_results(version_id, validated_at DESC);

CREATE TABLE IF NOT EXISTS directive_simulation_results (
  simulation_result_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES directive_profiles(profile_id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES directive_versions(version_id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  runtime_mode TEXT NOT NULL,
  report_family TEXT,
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directive_simulation_results_role
  ON directive_simulation_results(role_id, created_at DESC);

CREATE TABLE IF NOT EXISTS directive_audit_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  role_id TEXT,
  directive_version INTEGER,
  profile_id TEXT,
  version_id TEXT,
  actor TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  reason TEXT,
  before_snapshot_json TEXT,
  after_snapshot_json TEXT,
  runtime_context_json TEXT,
  request_id TEXT,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_directive_audit_events_role
  ON directive_audit_events(role_id, timestamp DESC);

CREATE TRIGGER IF NOT EXISTS trg_directive_versions_no_content_update_after_draft
BEFORE UPDATE ON directive_versions
WHEN OLD.approval_status <> 'draft' AND (
  OLD.purpose <> NEW.purpose OR
  OLD.decision_questions_json <> NEW.decision_questions_json OR
  OLD.primary_sources_json <> NEW.primary_sources_json OR
  OLD.advisory_sources_json <> NEW.advisory_sources_json OR
  OLD.output_contract <> NEW.output_contract OR
  OLD.current_directive_setting <> NEW.current_directive_setting OR
  OLD.hard_guardrails_json <> NEW.hard_guardrails_json OR
  OLD.do_not_allow_rules_json <> NEW.do_not_allow_rules_json OR
  OLD.required_evidence_json <> NEW.required_evidence_json OR
  OLD.confidence_thresholds_json <> NEW.confidence_thresholds_json OR
  OLD.freshness_tolerance_json <> NEW.freshness_tolerance_json OR
  OLD.escalation_triggers_json <> NEW.escalation_triggers_json OR
  OLD.publication_permissions_json <> NEW.publication_permissions_json OR
  OLD.external_communication_permissions_json <> NEW.external_communication_permissions_json OR
  OLD.report_family_applicability_json <> NEW.report_family_applicability_json OR
  OLD.effective_date <> NEW.effective_date OR
  OLD.directive_hash <> NEW.directive_hash
)
BEGIN
  SELECT RAISE(ABORT, 'Directive content is immutable after draft state.');
END;

CREATE TRIGGER IF NOT EXISTS trg_directive_runtime_snapshots_immutable
BEFORE UPDATE ON directive_runtime_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Directive runtime snapshots are immutable.');
END;

CREATE TRIGGER IF NOT EXISTS trg_directive_runtime_snapshots_no_delete
BEFORE DELETE ON directive_runtime_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Directive runtime snapshots cannot be deleted.');
END;

CREATE TRIGGER IF NOT EXISTS trg_directive_audit_events_immutable
BEFORE UPDATE ON directive_audit_events
BEGIN
  SELECT RAISE(ABORT, 'Directive audit events are immutable.');
END;

CREATE TRIGGER IF NOT EXISTS trg_directive_audit_events_no_delete
BEFORE DELETE ON directive_audit_events
BEGIN
  SELECT RAISE(ABORT, 'Directive audit events cannot be deleted.');
END;
