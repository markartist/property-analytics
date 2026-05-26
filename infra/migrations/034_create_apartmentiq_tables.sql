-- ApartmentIQ API source facts for advisory market/comps intelligence.
-- Data Pond internal operating facts remain authoritative for Venterra values.

CREATE TABLE IF NOT EXISTS apartmentiq_accounts (
  account_id INTEGER PRIMARY KEY,
  account_name TEXT NOT NULL,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apartmentiq_comp_sets (
  comp_set_id TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  comp_set_name TEXT,
  property_id TEXT,
  community_id TEXT,
  min_floorplan INTEGER,
  max_floorplan INTEGER,
  category TEXT,
  market_survey INTEGER,
  custom_property INTEGER,
  value_add INTEGER,
  subject_property_ids_json TEXT,
  owned_property_addresses_json TEXT,
  addresses_json TEXT,
  image_url TEXT,
  show_recommendations_link INTEGER,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_comp_sets_account
  ON apartmentiq_comp_sets(account_id);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_comp_sets_property
  ON apartmentiq_comp_sets(property_id);

CREATE TABLE IF NOT EXISTS apartmentiq_market_survey_items (
  id TEXT PRIMARY KEY,
  collection_date DATE NOT NULL,
  account_id INTEGER NOT NULL,
  comp_set_id TEXT NOT NULL,
  apartmentiq_property_id TEXT NOT NULL,
  property_id TEXT,
  community_id TEXT,
  subject_property INTEGER NOT NULL DEFAULT 0,
  property_name TEXT,
  management_company_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  distance REAL,
  year_built INTEGER,
  total_units INTEGER,
  number_of_stories INTEGER,
  avg_rent REAL,
  avg_sq_ft REAL,
  avg_rent_per_sq_ft REAL,
  exposure_current REAL,
  exposure_next_30_days REAL,
  exposure_next_60_days REAL,
  leased_percent REAL,
  advertised_occupancy_percent REAL,
  concession_percentage REAL,
  cancelled_applications_percentage_last_30_days REAL,
  review_average_rating REAL,
  review_count INTEGER,
  concessions_json TEXT,
  exposure_json TEXT,
  review_json TEXT,
  amenities_json TEXT,
  fees_and_deposits_json TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_date, comp_set_id, apartmentiq_property_id)
);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_market_survey_comp_set
  ON apartmentiq_market_survey_items(comp_set_id, collection_date DESC);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_market_survey_property
  ON apartmentiq_market_survey_items(property_id, collection_date DESC);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_market_survey_iq_property
  ON apartmentiq_market_survey_items(apartmentiq_property_id, collection_date DESC);

CREATE TABLE IF NOT EXISTS apartmentiq_units (
  id TEXT PRIMARY KEY,
  collection_date DATE NOT NULL,
  account_id INTEGER NOT NULL,
  comp_set_id TEXT NOT NULL,
  apartmentiq_unit_id TEXT NOT NULL,
  apartmentiq_property_id TEXT,
  property_id TEXT,
  community_id TEXT,
  subject_property INTEGER NOT NULL DEFAULT 0,
  property_name TEXT,
  unit_name TEXT,
  status TEXT,
  is_leased INTEGER,
  date_leased TEXT,
  date_available TEXT,
  days_on_market INTEGER,
  bedroom_count INTEGER,
  bathroom_count REAL,
  min_rent REAL,
  sq_ft INTEGER,
  floorplan_name TEXT,
  avg_rent_per_sq_ft REAL,
  last_rent_change_date TEXT,
  last_rent_change TEXT,
  total_30_day_rent_change TEXT,
  rent_changes_last_30_days INTEGER,
  is_trucomp INTEGER,
  net_effective_rent REAL,
  net_effective_rent_per_sq_ft REAL,
  annual_rent_reduction_value REAL,
  concessions_json TEXT,
  amenity_names_json TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collection_date, comp_set_id, apartmentiq_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_units_comp_set
  ON apartmentiq_units(comp_set_id, collection_date DESC);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_units_property
  ON apartmentiq_units(property_id, collection_date DESC);

CREATE TABLE IF NOT EXISTS apartmentiq_floorplans (
  id TEXT PRIMARY KEY,
  collection_date DATE NOT NULL,
  account_id INTEGER NOT NULL,
  comp_set_id TEXT NOT NULL,
  apartmentiq_property_id TEXT,
  property_id TEXT,
  community_id TEXT,
  subject_property INTEGER NOT NULL DEFAULT 0,
  property_name TEXT,
  floorplan_name TEXT,
  bedroom_count INTEGER,
  bathroom_count REAL,
  asking_rent REAL,
  asking_rent_change REAL,
  asking_rent_change_percent REAL,
  asking_rent_per_sq_ft REAL,
  net_effective_rent REAL,
  net_effective_rent_change REAL,
  net_effective_rent_change_percent REAL,
  net_effective_rent_per_sq_ft REAL,
  sqft REAL,
  days_on_market INTEGER,
  unit_count INTEGER,
  unit_mix_est REAL,
  unit_mix_percent REAL,
  aggregation_bucket TEXT,
  raw_json TEXT,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_floorplans_comp_set
  ON apartmentiq_floorplans(comp_set_id, collection_date DESC);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_floorplans_property
  ON apartmentiq_floorplans(property_id, collection_date DESC);

CREATE TABLE IF NOT EXISTS apartmentiq_property_identity_links (
  apartmentiq_property_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  community_id TEXT,
  property_name TEXT,
  apartmentiq_property_name TEXT,
  account_id INTEGER,
  comp_set_id TEXT,
  match_method TEXT NOT NULL,
  evidence_json TEXT,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apartmentiq_identity_links_property
  ON apartmentiq_property_identity_links(property_id);
