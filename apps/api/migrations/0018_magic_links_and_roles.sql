-- Migration 0018: Magic link auth + expanded role system (v2)
-- Adds magic_tokens table, expands roles to admin/editor/viewer,
-- makes password_hash nullable for magic-link-only users.
--
-- Strategy: D1 strictly enforces FK constraints. To change CHECK constraints
-- on users/invites, we must first recreate child tables (sessions, audit_log)
-- without FK references, then safely recreate parent tables.

-- ─── Step 1: Create magic_tokens table ───
CREATE TABLE IF NOT EXISTS magic_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_magic_tokens_email ON magic_tokens(email);
CREATE INDEX idx_magic_tokens_expires ON magic_tokens(expires_at);

-- ─── Step 2: Recreate sessions (child table, references users) ───
CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT INTO sessions_new SELECT * FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

-- ─── Step 3: Recreate audit_log (child table, references users) ───
CREATE TABLE audit_log_new (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO audit_log_new SELECT * FROM audit_log;
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;

-- ─── Step 4: Drop invites (also references users) ───
CREATE TABLE invites_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_user_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT INTO invites_new (id, email, role, token_hash, expires_at, redeemed_at,
  redeemed_user_id, created_at, created_by, updated_at, updated_by)
SELECT id, email,
  CASE WHEN role = 'user' THEN 'editor' ELSE role END,
  token_hash, expires_at, redeemed_at, redeemed_user_id, created_at, created_by, updated_at, updated_by
FROM invites;

DROP TABLE invites;
ALTER TABLE invites_new RENAME TO invites;

-- ─── Step 5: Now safely recreate users (no FK references remain) ───
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT
);

INSERT INTO users_new (id, email, full_name, password_hash, role, is_active,
  last_login_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
SELECT id, email, full_name, password_hash,
  CASE WHEN role = 'user' THEN 'editor' ELSE role END,
  is_active, last_login_at, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
