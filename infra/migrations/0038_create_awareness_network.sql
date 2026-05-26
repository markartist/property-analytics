-- Awareness Network / Memory Stewardship foundation.
-- Additive memory substrate; does not promote memory to Data Pond truth.

CREATE TABLE IF NOT EXISTS awareness_agent_identities (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('captain', 'commodore', 'fleet', 'expert_lane', 'scribe')),
  display_name TEXT NOT NULL,
  formal_title TEXT NOT NULL,
  assigned_property_id TEXT,
  assigned_region_id TEXT,
  assigned_lane_id TEXT,
  active_status TEXT NOT NULL CHECK (active_status IN ('active', 'retired')),
  created_at TEXT NOT NULL,
  retired_at TEXT,
  identity_version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awareness_agents_property ON awareness_agent_identities(assigned_property_id, active_status);
CREATE INDEX IF NOT EXISTS idx_awareness_agents_region ON awareness_agent_identities(assigned_region_id, active_status);

CREATE TABLE IF NOT EXISTS awareness_agent_charters (
  charter_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  sphere_of_responsibility TEXT NOT NULL,
  sphere_of_knowledge TEXT NOT NULL,
  sphere_of_action TEXT NOT NULL,
  sphere_of_memory TEXT NOT NULL,
  visibility_scope TEXT NOT NULL,
  allowed_actions_json TEXT NOT NULL,
  blocked_actions_json TEXT NOT NULL,
  allowed_memory_classes_json TEXT NOT NULL,
  blocked_memory_classes_json TEXT NOT NULL,
  authority_boundaries_json TEXT NOT NULL,
  care_obligations_json TEXT NOT NULL,
  escalation_obligations_json TEXT NOT NULL,
  steward_roles_json TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  version INTEGER NOT NULL,
  approval_status TEXT NOT NULL CHECK (approval_status IN ('draft', 'approved', 'retired')),
  FOREIGN KEY (agent_id) REFERENCES awareness_agent_identities(agent_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_awareness_charters_agent ON awareness_agent_charters(agent_id, approval_status);

CREATE TABLE IF NOT EXISTS awareness_memory_items (
  memory_id TEXT PRIMARY KEY,
  memory_class TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL,
  property_id TEXT,
  region_id TEXT,
  agent_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  statement TEXT NOT NULL,
  structured_claim_json TEXT,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  freshness_state TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  visibility_scope TEXT NOT NULL,
  allowed_uses_json TEXT NOT NULL,
  blocked_uses_json TEXT NOT NULL,
  steward TEXT NOT NULL,
  verification_required INTEGER NOT NULL CHECK (verification_required IN (0, 1)),
  correction_path TEXT NOT NULL,
  fresh_until TEXT,
  expires_at TEXT,
  revalidation_due_at TEXT,
  archived_at TEXT,
  archived_reason TEXT,
  superseded_by TEXT,
  evidence_refs_json TEXT NOT NULL,
  directive_refs_json TEXT NOT NULL,
  care_metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awareness_memory_property ON awareness_memory_items(property_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_awareness_memory_agent ON awareness_memory_items(agent_id, lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_awareness_memory_region ON awareness_memory_items(region_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS awareness_self_notes (
  note_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  property_id TEXT,
  region_id TEXT,
  note_text TEXT NOT NULL,
  note_type TEXT NOT NULL,
  importance INTEGER NOT NULL CHECK (importance >= 1 AND importance <= 5),
  visibility TEXT NOT NULL,
  reminder_at TEXT,
  expires_at TEXT,
  archived_at TEXT,
  source_context TEXT,
  related_memory_id TEXT,
  related_interaction_id TEXT,
  related_expert_read_id TEXT,
  care_metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awareness_self_notes_property ON awareness_self_notes(property_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_awareness_self_notes_agent ON awareness_self_notes(agent_id, archived_at);

CREATE TABLE IF NOT EXISTS awareness_commitments (
  commitment_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  property_id TEXT,
  region_id TEXT,
  commitment_type TEXT NOT NULL,
  description TEXT NOT NULL,
  owed_by TEXT NOT NULL,
  owed_to TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'waiting', 'completed', 'blocked', 'expired', 'archived')),
  source_ref TEXT,
  related_memory_id TEXT,
  related_interaction_id TEXT,
  related_expert_read_id TEXT,
  care_metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_awareness_commitments_property ON awareness_commitments(property_id, status);
CREATE INDEX IF NOT EXISTS idx_awareness_commitments_agent ON awareness_commitments(agent_id, status);

CREATE TABLE IF NOT EXISTS awareness_regional_summaries (
  summary_id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  summary_period TEXT NOT NULL,
  steward_agent_id TEXT NOT NULL,
  source_property_count INTEGER NOT NULL,
  pattern_summary TEXT NOT NULL,
  sibling_property_cards_json TEXT NOT NULL,
  market_context TEXT NOT NULL,
  shared_risks_json TEXT NOT NULL,
  successful_tactics_json TEXT NOT NULL,
  cautionary_notes_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  visibility_scope TEXT NOT NULL,
  freshness_state TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_awareness_regional_summaries_region ON awareness_regional_summaries(region_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS awareness_doctrine_candidates (
  doctrine_candidate_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pattern_statement TEXT NOT NULL,
  source_scope TEXT NOT NULL CHECK (source_scope IN ('property', 'region', 'fleet')),
  supporting_memory_refs_json TEXT NOT NULL,
  supporting_evidence_refs_json TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  proposed_by_agent_id TEXT NOT NULL,
  steward_agent_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected', 'archived')),
  care_review_required INTEGER NOT NULL CHECK (care_review_required IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS awareness_memory_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT,
  agent_id TEXT,
  property_id TEXT,
  region_id TEXT,
  memory_id TEXT,
  note_id TEXT,
  commitment_id TEXT,
  action TEXT NOT NULL,
  before_state_json TEXT,
  after_state_json TEXT,
  reason TEXT,
  care_rule_triggered TEXT,
  timestamp TEXT NOT NULL,
  correlation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_awareness_events_property ON awareness_memory_events(property_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_awareness_events_agent ON awareness_memory_events(agent_id, timestamp DESC);
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_events_immutable
  BEFORE UPDATE ON awareness_memory_events
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory events are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_events_no_delete
  BEFORE DELETE ON awareness_memory_events
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory events cannot be deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_items_no_delete
  BEFORE DELETE ON awareness_memory_items
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory items must be archived, expired, rejected, or superseded, not deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_no_publication_state
  BEFORE UPDATE OF lifecycle_state ON awareness_memory_items
  WHEN NEW.lifecycle_state IN ('report_eligible', 'approved_doctrine')
  BEGIN
    SELECT RAISE(ABORT, 'Publication-eligible memory states require a future governed workflow.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_self_notes_no_delete
  BEFORE DELETE ON awareness_self_notes
  BEGIN
    SELECT RAISE(ABORT, 'Awareness self notes must be archived, not deleted.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_commitments_no_delete
  BEFORE DELETE ON awareness_commitments
  BEGIN
    SELECT RAISE(ABORT, 'Awareness commitments must be closed or archived, not deleted.');
  END;

CREATE TABLE IF NOT EXISTS awareness_memory_links (
  link_id TEXT PRIMARY KEY,
  source_memory_id TEXT NOT NULL,
  target_ref_type TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS awareness_memory_corrections (
  correction_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  correction_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'accepted', 'rejected', 'archived')),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_corrections_immutable
  BEFORE UPDATE ON awareness_memory_corrections
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory corrections are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_corrections_no_delete
  BEFORE DELETE ON awareness_memory_corrections
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory corrections cannot be deleted.');
  END;

CREATE TABLE IF NOT EXISTS awareness_memory_archives (
  archive_id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  archived_by TEXT NOT NULL,
  archived_reason TEXT NOT NULL,
  archived_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_archives_immutable
  BEFORE UPDATE ON awareness_memory_archives
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory archives are immutable.');
  END;
CREATE TRIGGER IF NOT EXISTS trg_awareness_memory_archives_no_delete
  BEFORE DELETE ON awareness_memory_archives
  BEGIN
    SELECT RAISE(ABORT, 'Awareness memory archives cannot be deleted.');
  END;
