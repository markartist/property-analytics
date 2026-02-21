-- Migration 006: marketing_weekly
-- Per 05_Data_Model.md: weekly marketing and mention-oriented context
-- Per ADR-0002: week_ending must be Friday (enforced at application layer)

CREATE TABLE IF NOT EXISTS marketing_weekly (
  id TEXT PRIMARY KEY,
  week_ending TEXT NOT NULL,
  community_id TEXT NOT NULL REFERENCES communities(id),
  leads_count INTEGER,
  cost_per_lead REAL,
  ad_spend REAL,
  mentions_json TEXT,
  notes_text TEXT,
  source_import_run_id TEXT REFERENCES import_runs(id),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Composite uniqueness: (week_ending, community_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_weekly_composite
  ON marketing_weekly(week_ending, community_id);

CREATE INDEX IF NOT EXISTS idx_marketing_weekly_date ON marketing_weekly(week_ending);
CREATE INDEX IF NOT EXISTS idx_marketing_weekly_community ON marketing_weekly(community_id);
