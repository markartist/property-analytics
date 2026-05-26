CREATE TABLE IF NOT EXISTS thirtylines_feed_snapshots (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL,
  fetched_at TIMESTAMP NOT NULL,
  feed_url TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  raw_payload_json TEXT NOT NULL,
  properties_seen INTEGER DEFAULT 0,
  properties_mapped INTEGER DEFAULT 0,
  properties_unmapped INTEGER DEFAULT 0,
  floorplans_seen INTEGER DEFAULT 0,
  units_seen INTEGER DEFAULT 0,
  units_with_specials INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_date, payload_sha256)
);

CREATE TABLE IF NOT EXISTS unit_availability_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL,
  property_id TEXT NOT NULL,
  feed_property_id TEXT,
  feed_property_name TEXT,
  floorplan_id TEXT,
  floorplan_name TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  building TEXT,
  apt_number TEXT,
  level TEXT,
  rent_from REAL,
  rent_to REAL,
  moved_out_date DATE,
  available_date DATE,
  days_until_available INTEGER,
  availability_bucket TEXT,
  pricing_and_specials_message TEXT,
  concession_amount REAL,
  tour_url TEXT,
  quote_url TEXT,
  application_url TEXT,
  matterport_url TEXT,
  features_json TEXT,
  images_json TEXT,
  videos_json TEXT,
  raw_unit_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(property_id, snapshot_date, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_availability_units_property_date
  ON unit_availability_units(property_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_unit_availability_units_floorplan
  ON unit_availability_units(property_id, snapshot_date DESC, floorplan_name);

CREATE INDEX IF NOT EXISTS idx_unit_availability_units_specials
  ON unit_availability_units(property_id, snapshot_date DESC, concession_amount);
