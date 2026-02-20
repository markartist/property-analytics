-- Migration 003: invites
-- Per 05_Data_Model.md: admin-created invite tokens
-- Per 01_System_Contract.md: invites are admin-created only

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
