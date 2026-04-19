-- Migration 0022: Runtime release state bridge
-- Purpose:
--   Persist operator- or CI-issued release provenance in D1 so Watchtower can
--   read live release pedigree without depending only on bundled static config.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS runtime_release_state (
  state_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('operator_bridge', 'ci_issued', 'runtime_bridge')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_release_state_updated_at
  ON runtime_release_state(updated_at DESC);
