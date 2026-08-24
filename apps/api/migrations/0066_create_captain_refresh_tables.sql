-- Captain Cloudflare refresh control plane.
-- Cloudflare-owned scheduled refresh state for Captain persona/profile deadlines
-- and compact Office Wall snapshots. Source systems remain governed upstream.

CREATE TABLE IF NOT EXISTS captain_persona_profiles (
  profile_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL UNIQUE,
  captain_display_name TEXT NOT NULL,
  office_name TEXT NOT NULL,
  persona_status TEXT NOT NULL DEFAULT 'active'
    CHECK (persona_status IN ('active', 'paused', 'retired')),
  family_composition_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (family_composition_status IN ('not_started', 'drafted', 'captain_selected', 'asset_generated', 'approved')),
  family_composition_due_at TEXT NOT NULL,
  family_composition_type TEXT,
  family_caption TEXT,
  portrait_asset_key TEXT,
  family_portrait_asset_key TEXT,
  property_photo_asset_key TEXT,
  property_photo_url TEXT,
  profile_owned_by TEXT NOT NULL DEFAULT 'captain',
  composition_selected_by TEXT,
  composition_selected_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  source_agent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_persona_profiles_due
  ON captain_persona_profiles(family_composition_status, family_composition_due_at);

CREATE TABLE IF NOT EXISTS captain_refresh_runs (
  run_id TEXT PRIMARY KEY,
  refresh_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (refresh_type IN ('scheduled', 'manual', 'canary')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  property_count INTEGER NOT NULL DEFAULT 0,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  persona_created_count INTEGER NOT NULL DEFAULT 0,
  persona_due_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  r2_manifest_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captain_refresh_runs_started
  ON captain_refresh_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS captain_office_wall_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  captain_display_name TEXT NOT NULL,
  office_name TEXT NOT NULL,
  family_composition_status TEXT NOT NULL,
  family_composition_due_at TEXT NOT NULL,
  open_watch_count INTEGER NOT NULL DEFAULT 0,
  critical_watch_count INTEGER NOT NULL DEFAULT 0,
  open_action_count INTEGER NOT NULL DEFAULT 0,
  blocked_action_count INTEGER NOT NULL DEFAULT 0,
  ops_signal_count INTEGER NOT NULL DEFAULT 0,
  high_ops_signal_count INTEGER NOT NULL DEFAULT 0,
  open_commitment_count INTEGER NOT NULL DEFAULT 0,
  verification_needed_count INTEGER NOT NULL DEFAULT 0,
  latest_runtime_at TEXT,
  latest_runtime_mode TEXT,
  latest_evidence_at TEXT,
  latest_evidence_hash TEXT,
  r2_key TEXT,
  summary_json TEXT NOT NULL,
  status_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES captain_refresh_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_captain_office_wall_current
  ON captain_office_wall_snapshots(property_id, is_current, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_captain_office_wall_pressure
  ON captain_office_wall_snapshots(is_current, critical_watch_count DESC, open_action_count DESC, high_ops_signal_count DESC);
