-- Migration 0026: Captain support agents
-- Defines property-scoped support agents that keep a Captain's Log supplied with governed source truth.

CREATE TABLE IF NOT EXISTS captain_support_agents (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  captain_memory_entry_id TEXT REFERENCES governed_memory_entries(id) ON DELETE SET NULL,
  agent_key TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  role TEXT NOT NULL,
  responsibility TEXT NOT NULL,
  source_scope_json TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (property_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_captain_support_agents_property
  ON captain_support_agents(property_id, status, cadence);

CREATE INDEX IF NOT EXISTS idx_captain_support_agents_memory
  ON captain_support_agents(captain_memory_entry_id);
