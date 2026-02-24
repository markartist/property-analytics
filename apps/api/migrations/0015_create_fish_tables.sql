-- Migration 0015: Create Fishing Hole tables
-- Audit logging + conversation persistence for AI chat

-- ─── 1. Conversations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fish_conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  title       TEXT,              -- auto-generated from first question
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fish_conv_user    ON fish_conversations(user_id, updated_at DESC);

-- ─── 2. Messages ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fish_messages (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES fish_conversations(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT,                  -- text content of the message
  tables_json       TEXT,                  -- JSON: array of table data objects
  csvs_json         TEXT,                  -- JSON: array of {key, filename, row_count}
  tool_events_json  TEXT,                  -- JSON: array of tool event objects
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fish_msg_conv ON fish_messages(conversation_id, created_at);

-- ─── 3. Audit Log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fish_audit_log (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  user_email        TEXT NOT NULL,
  conversation_id   TEXT REFERENCES fish_conversations(id) ON DELETE SET NULL,
  question          TEXT NOT NULL,          -- the user's original question
  tool_name         TEXT,                   -- which tool was called
  tool_input_json   TEXT,                   -- JSON of tool input (includes SQL)
  row_count         INTEGER,                -- rows returned (for query_pond)
  error             TEXT,                   -- error message if tool failed
  duration_ms       INTEGER,                -- wall time for the full cast
  model             TEXT DEFAULT 'gpt-4o',
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fish_audit_user ON fish_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fish_audit_date ON fish_audit_log(created_at DESC);
