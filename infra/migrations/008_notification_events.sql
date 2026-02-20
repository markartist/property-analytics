-- Migration 008: notification_events
-- Per 05_Data_Model.md: dedupe and delivery tracking for outbound notifications
-- Per 01_System_Contract.md: dedupe_key must be unique; duplicate = idempotent success

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('suppressed_duplicate', 'sent', 'failed')),
  provider_message_id TEXT,
  attempted_at TEXT NOT NULL,
  error_text TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_recipient ON notification_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notification_events_dedupe ON notification_events(dedupe_key);
