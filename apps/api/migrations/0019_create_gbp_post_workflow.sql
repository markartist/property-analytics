-- Migration 0019: GBP post workflow tables
-- Adds source snapshots, drafts, reviews, publications, and policies
-- for a human-in-the-loop Google Business Profile posting workflow.

CREATE TABLE IF NOT EXISTS gbp_post_source_snapshots (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  source_kind TEXT NOT NULL DEFAULT 'context_builder',
  snapshot_hash TEXT,
  source_payload_json TEXT NOT NULL,
  freshness_json TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbp_post_source_snapshots_community
  ON gbp_post_source_snapshots(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gbp_post_policies (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  approval_required INTEGER NOT NULL DEFAULT 1,
  allow_offer_posts INTEGER NOT NULL DEFAULT 0,
  allow_event_posts INTEGER NOT NULL DEFAULT 0,
  allow_amenity_posts INTEGER NOT NULL DEFAULT 1,
  cooldown_days INTEGER NOT NULL DEFAULT 7,
  max_drafts_per_run INTEGER NOT NULL DEFAULT 3,
  policy_json TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gbp_post_policies_community
  ON gbp_post_policies(community_id);

CREATE TABLE IF NOT EXISTS gbp_post_drafts (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'approved', 'rejected', 'published', 'failed')) DEFAULT 'draft',
  post_type TEXT NOT NULL CHECK(post_type IN ('STANDARD', 'EVENT', 'OFFER')),
  angle TEXT NOT NULL,
  candidate_rank INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  rendered_text TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  validation_json TEXT,
  model_name TEXT,
  generation_notes TEXT,
  approved_at TEXT,
  approved_by TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbp_post_drafts_status
  ON gbp_post_drafts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gbp_post_drafts_community
  ON gbp_post_drafts(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gbp_post_reviews (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approve', 'reject')),
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbp_post_reviews_draft
  ON gbp_post_reviews(draft_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gbp_post_publications (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  community_id TEXT NOT NULL,
  publish_status TEXT NOT NULL CHECK(publish_status IN ('pending', 'preview', 'published', 'failed')) DEFAULT 'pending',
  google_post_name TEXT,
  request_json TEXT,
  response_json TEXT,
  error_message TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_gbp_post_publications_draft
  ON gbp_post_publications(draft_id, created_at DESC);
