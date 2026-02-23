-- Migration 0013: Enrich communities table with property metadata
-- Adds columns for the unified data pond: manager, unit count, GA4 ID, URLs, Encasa mapping

ALTER TABLE communities ADD COLUMN manager_name TEXT;
ALTER TABLE communities ADD COLUMN unit_count INTEGER;
ALTER TABLE communities ADD COLUMN ga4_property_id TEXT;
ALTER TABLE communities ADD COLUMN full_url TEXT;
ALTER TABLE communities ADD COLUMN encasa_short_name TEXT;
ALTER TABLE communities ADD COLUMN encasa_property_code TEXT;
ALTER TABLE communities ADD COLUMN city TEXT;
ALTER TABLE communities ADD COLUMN state TEXT;
