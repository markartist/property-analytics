-- Migration 0011: Create t30_metrics table
-- Identical schema to t7_metrics for 30-day performance window

CREATE TABLE IF NOT EXISTS t30_metrics (
  id                    TEXT PRIMARY KEY,
  community_id          TEXT NOT NULL REFERENCES communities(id),
  week_date             TEXT NOT NULL,  -- YYYY-MM-DD, must be a Friday
  type                  TEXT NOT NULL CHECK (type IN ('community', 'portfolio')),

  -- Leasing funnel counts
  g_cards               INTEGER,
  visits                INTEGER,
  first_tours           INTEGER,
  apps                  INTEGER,
  leases                INTEGER,
  c_and_ds              INTEGER,
  move_ins              INTEGER,

  -- Conversion rates
  v_gc_conv             REAL,
  a_gc_conv             REAL,
  l_gc_conv             REAL,
  l_v_ratio             REAL,
  c_d_pct_of_gcs        REAL,
  mi_gc_conv            REAL,
  mi_v_ratio            REAL,

  -- Month-over-month deltas
  g_cards_delta         REAL,
  visits_delta          REAL,
  apps_delta            REAL,
  leases_delta          REAL,
  c_and_ds_delta        REAL,
  move_ins_delta        REAL,
  v_gc_conv_delta       REAL,
  a_gc_conv_delta       REAL,
  l_gc_conv_delta       REAL,
  l_v_ratio_delta       REAL,
  c_d_pct_of_gcs_delta  REAL,
  mi_gc_conv_delta      REAL,
  mi_v_ratio_delta      REAL,

  -- Import tracking
  source_import_run_id  TEXT,

  -- Audit
  created_at            TEXT NOT NULL,
  created_by            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  updated_by            TEXT NOT NULL,

  UNIQUE(community_id, week_date, type)
);

CREATE INDEX IF NOT EXISTS idx_t30_metrics_community_date ON t30_metrics(community_id, week_date);
CREATE INDEX IF NOT EXISTS idx_t30_metrics_week_date      ON t30_metrics(week_date);
CREATE INDEX IF NOT EXISTS idx_t30_metrics_type_date       ON t30_metrics(type, week_date);
